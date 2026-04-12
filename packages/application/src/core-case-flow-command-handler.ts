import {
  ADLCase,
  ADLCaseState,
  ADLCaseStateMachine,
  CaseState,
  type CoreCaseAuditType,
  type CaseAuditRecord,
  CORE_CASE_AUDIT_TYPES,
  LiquidationCase,
  LiquidationCaseState,
  LiquidationCaseStateMachine,
  type RiskCase,
  RiskCaseStateMachine,
  TransitionAction,
  createCaseAuditRecord
} from "@tianqi/domain";
import {
  createADLCaseId,
  createConfigVersion,
  createLiquidationCaseId,
  createRiskCaseId,
  createTraceId
} from "@tianqi/shared";
import type { Result } from "@tianqi/shared";
import type {
  ADLCaseRepositoryPort,
  CoordinationMetricsSinkPort,
  CoordinationResultStorePort,
  LiquidationCaseRepositoryPort,
  RiskCaseRepositoryPort
} from "@tianqi/ports";

import {
  dependencyFailureError,
  fromDomainError,
  invalidApplicationCommandError,
  resourceNotFoundError
} from "./application-error.js";
import type { ApplicationError } from "./application-error.js";
import {
  isRiskCaseStateAllowedForDerivation,
  isRiskCaseStateAllowedForSpecialCaseTransition
} from "./core-case-linkage-policy.js";
import type {
  CoreCaseAuditRecordView,
  CoreCaseConsistencyCheckView,
  CoreCaseFlowResult,
  CoreCaseResolutionView,
  CoreSubcaseKind,
  CoreCaseTransitionView,
  CoreCaseView
} from "./core-case-flow-command-result.js";
import type { CoordinateRiskCaseAfterSubcaseTerminalCommand } from "./coordinate-risk-case-after-subcase-terminal-command.js";
import type { CreateADLCaseFromRiskCaseCommand } from "./create-adl-case-from-risk-case-command.js";
import type { CreateADLCaseCommand } from "./create-adl-case-command.js";
import type { CreateLiquidationCaseFromRiskCaseCommand } from "./create-liquidation-case-from-risk-case-command.js";
import type { CreateLiquidationCaseCommand } from "./create-liquidation-case-command.js";
import { RiskCaseResolutionAction } from "./risk-case-resolution-action.js";
import type { TransitionADLCaseCommand } from "./transition-adl-case-command.js";
import type { TransitionLiquidationCaseCommand } from "./transition-liquidation-case-command.js";
import type { TransitionRiskCaseCommand } from "./transition-risk-case-command.js";
import {
  buildRiskCaseSubcaseCoordinationContext,
  toCoordinationContextAuditFields,
  type RiskCaseSubcaseCoordinationContext
} from "./risk-case-subcase-coordination-context.js";
import {
  buildSubcaseTerminalSignalOrdering,
  type SubcaseTerminalSignalOrdering
} from "./risk-case-coordination-signal-ordering.js";
import { getResolutionPriority, getRiskCaseCurrentPriority } from "./risk-case-resolution-priority.js";
import { CoordinationResultRegistry } from "./coordination-result-registry.js";
import { mapCoordinationResultViewToStoredRecord, mapStoredCoordinationResultToReadView } from "./coordination-result-persistence-mapper.js";
import { validateCoordinationResultReplayCompatibility } from "./coordination-result-replay-validation.js";
import { buildCoordinationResultObservation } from "./coordination-result-observation.js";
import { CoordinationResultObservationRegistry } from "./coordination-result-observation-registry.js";
import {
  assertCoordinationResultViewsConsistent,
  projectCoreCaseFlowResultToCoordinationResultView,
  type CoordinationSourceCommandPath
} from "./risk-case-coordination-result-read-view.js";

type CoreCaseFlowCommandHandlerDependencies = {
  readonly riskCaseRepository: RiskCaseRepositoryPort;
  readonly liquidationCaseRepository: LiquidationCaseRepositoryPort;
  readonly adlCaseRepository: ADLCaseRepositoryPort;
  readonly coordinationResultRegistry?: CoordinationResultRegistry;
  readonly coordinationResultStore?: CoordinationResultStorePort;
  readonly coordinationMetricsSink?: CoordinationMetricsSinkPort;
  readonly coordinationObservationRegistry?: CoordinationResultObservationRegistry;
  readonly riskCaseStateMachine?: RiskCaseStateMachine;
  readonly liquidationCaseStateMachine?: LiquidationCaseStateMachine;
  readonly adlCaseStateMachine?: ADLCaseStateMachine;
};

const ISO_8601_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;

const parseIsoUtcDate = (
  value: string,
  fieldName: string
): Result<Date, ApplicationError> => {
  if (!ISO_8601_PATTERN.test(value)) {
    return {
      ok: false,
      error: invalidApplicationCommandError("Command timestamp must use UTC ISO-8601 format", {
        fieldName,
        value
      })
    };
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return {
      ok: false,
      error: invalidApplicationCommandError("Command timestamp value is invalid", {
        fieldName,
        value
      })
    };
  }
  return { ok: true, value: parsed };
};

type LinkageConsistencyRuleResult = {
  readonly passed: true;
  readonly rule: string;
  readonly detail: string;
};

type RiskCaseResolutionPlan = {
  readonly action: RiskCaseResolutionAction;
  readonly transitionAction?: TransitionAction;
  readonly riskCaseTransitionApplied: boolean;
  readonly decision: "applied" | "deferred" | "rejected" | "ignored" | "duplicate";
  readonly selectedPriority: number;
  readonly arbitrationRule: string;
  readonly detail: string;
};

export class CoreCaseFlowCommandHandler {
  private readonly riskCaseRepository: RiskCaseRepositoryPort;
  private readonly liquidationCaseRepository: LiquidationCaseRepositoryPort;
  private readonly adlCaseRepository: ADLCaseRepositoryPort;
  private readonly riskCaseStateMachine: RiskCaseStateMachine;
  private readonly liquidationCaseStateMachine: LiquidationCaseStateMachine;
  private readonly adlCaseStateMachine: ADLCaseStateMachine;
  private readonly coordinationResultRegistry: CoordinationResultRegistry;
  private readonly coordinationResultStore: CoordinationResultStorePort | undefined;
  private readonly coordinationMetricsSink: CoordinationMetricsSinkPort | undefined;
  private readonly coordinationObservationRegistry: CoordinationResultObservationRegistry;

  public constructor(dependencies: CoreCaseFlowCommandHandlerDependencies) {
    this.riskCaseRepository = dependencies.riskCaseRepository;
    this.liquidationCaseRepository = dependencies.liquidationCaseRepository;
    this.adlCaseRepository = dependencies.adlCaseRepository;
    this.riskCaseStateMachine = dependencies.riskCaseStateMachine ?? new RiskCaseStateMachine();
    this.liquidationCaseStateMachine =
      dependencies.liquidationCaseStateMachine ?? new LiquidationCaseStateMachine();
    this.adlCaseStateMachine = dependencies.adlCaseStateMachine ?? new ADLCaseStateMachine();
    this.coordinationResultRegistry =
      dependencies.coordinationResultRegistry ?? new CoordinationResultRegistry();
    this.coordinationResultStore = dependencies.coordinationResultStore;
    this.coordinationMetricsSink = dependencies.coordinationMetricsSink;
    this.coordinationObservationRegistry =
      dependencies.coordinationObservationRegistry ?? new CoordinationResultObservationRegistry();
  }

  public getCoordinationResultRegistry(): CoordinationResultRegistry {
    return this.coordinationResultRegistry;
  }

  public getCoordinationObservationRegistry(): CoordinationResultObservationRegistry {
    return this.coordinationObservationRegistry;
  }

  public async handleCreateLiquidationCase(command: CreateLiquidationCaseCommand): Promise<CoreCaseFlowResult> {
    return this.handleCreateLiquidationCaseFromRiskCase({
      traceId: command.traceId,
      liquidationCaseId: command.liquidationCaseId,
      riskCaseId: command.sourceRiskCaseId,
      reason: "legacy-create-liquidation-case-command",
      triggeredBy: "system",
      configVersion: command.configVersion,
      createdAt: command.createdAt
    });
  }

  public async handleCreateLiquidationCaseFromRiskCase(
    command: CreateLiquidationCaseFromRiskCaseCommand
  ): Promise<CoreCaseFlowResult> {
    const createdAt = parseIsoUtcDate(command.createdAt, "createdAt");
    if (!createdAt.ok) {
      return this.failure("LiquidationCase", "create", createdAt.error);
    }

    let liquidationCaseId;
    let riskCaseId;
    let traceId;
    let configVersion;
    try {
      liquidationCaseId = createLiquidationCaseId(command.liquidationCaseId);
      riskCaseId = createRiskCaseId(command.riskCaseId);
      traceId = createTraceId(command.traceId);
      configVersion = createConfigVersion(command.configVersion);
    } catch (error) {
      return this.failure(
        "LiquidationCase",
        "create",
        invalidApplicationCommandError("CreateLiquidationCaseFromRiskCaseCommand has invalid identifiers", {
          cause: error instanceof Error ? error.message : "unknown"
        })
      );
    }

    const loadedRiskCase = await this.loadRiskCaseOrFail(riskCaseId, "LiquidationCase", "create");
    if (!loadedRiskCase.ok) {
      return loadedRiskCase.error;
    }

    const derivationRule = this.ensureRiskCaseAllowsDerivation(
      loadedRiskCase.value.state,
      "LiquidationCase",
      riskCaseId
    );
    if (!derivationRule.ok) {
      return derivationRule.error;
    }

    const created = LiquidationCase.create({
      id: liquidationCaseId,
      sourceRiskCaseId: riskCaseId,
      traceId,
      configVersion,
      createdAt: createdAt.value
    });
    if (!created.ok) {
      return this.failure("LiquidationCase", "create", fromDomainError(created.error));
    }

    const saved = await this.liquidationCaseRepository.save(created.value);
    if (!saved.ok) {
      return this.failure(
        "LiquidationCase",
        "create",
        dependencyFailureError("Failed to persist LiquidationCase", {
          caseId: created.value.id,
          message: saved.error.message
        })
      );
    }

    const auditRecords = this.createAuditRecordsForDerivedCaseCreate({
      caseType: CORE_CASE_AUDIT_TYPES.LiquidationCase,
      caseId: created.value.id,
      relatedRiskCaseId: riskCaseId,
      sourceRiskCaseState: loadedRiskCase.value.state,
      action: "CreateLiquidationCaseFromRiskCase",
      reason: command.reason,
      traceId,
      occurredAt: createdAt.value
    });
    if (!auditRecords.ok) {
      return this.failure("LiquidationCase", "create", auditRecords.error);
    }

    return {
      success: true,
      caseView: this.toLiquidationCaseView(created.value),
      linkage: {
        riskCaseId,
        derivedCaseId: created.value.id,
        consistencyChecks: [this.toConsistencyCheckView(derivationRule.value)]
      },
      auditRecords: auditRecords.value.map((record) => this.toAuditRecordView(record))
    };
  }

  public async handleCreateADLCase(command: CreateADLCaseCommand): Promise<CoreCaseFlowResult> {
    return this.handleCreateADLCaseFromRiskCase({
      traceId: command.traceId,
      adlCaseId: command.adlCaseId,
      riskCaseId: command.sourceRiskCaseId,
      reason: "legacy-create-adl-case-command",
      triggeredBy: "system",
      configVersion: command.configVersion,
      createdAt: command.createdAt
    });
  }

  public async handleCreateADLCaseFromRiskCase(
    command: CreateADLCaseFromRiskCaseCommand
  ): Promise<CoreCaseFlowResult> {
    const createdAt = parseIsoUtcDate(command.createdAt, "createdAt");
    if (!createdAt.ok) {
      return this.failure("ADLCase", "create", createdAt.error);
    }

    let adlCaseId;
    let riskCaseId;
    let traceId;
    let configVersion;
    try {
      adlCaseId = createADLCaseId(command.adlCaseId);
      riskCaseId = createRiskCaseId(command.riskCaseId);
      traceId = createTraceId(command.traceId);
      configVersion = createConfigVersion(command.configVersion);
    } catch (error) {
      return this.failure(
        "ADLCase",
        "create",
        invalidApplicationCommandError("CreateADLCaseFromRiskCaseCommand has invalid identifiers", {
          cause: error instanceof Error ? error.message : "unknown"
        })
      );
    }

    const loadedRiskCase = await this.loadRiskCaseOrFail(riskCaseId, "ADLCase", "create");
    if (!loadedRiskCase.ok) {
      return loadedRiskCase.error;
    }

    const derivationRule = this.ensureRiskCaseAllowsDerivation(
      loadedRiskCase.value.state,
      "ADLCase",
      riskCaseId
    );
    if (!derivationRule.ok) {
      return derivationRule.error;
    }

    const created = ADLCase.create({
      id: adlCaseId,
      sourceRiskCaseId: riskCaseId,
      traceId,
      configVersion,
      createdAt: createdAt.value
    });
    if (!created.ok) {
      return this.failure("ADLCase", "create", fromDomainError(created.error));
    }

    const saved = await this.adlCaseRepository.save(created.value);
    if (!saved.ok) {
      return this.failure(
        "ADLCase",
        "create",
        dependencyFailureError("Failed to persist ADLCase", {
          caseId: created.value.id,
          message: saved.error.message
        })
      );
    }

    const auditRecords = this.createAuditRecordsForDerivedCaseCreate({
      caseType: CORE_CASE_AUDIT_TYPES.ADLCase,
      caseId: created.value.id,
      relatedRiskCaseId: riskCaseId,
      sourceRiskCaseState: loadedRiskCase.value.state,
      action: "CreateADLCaseFromRiskCase",
      reason: command.reason,
      traceId,
      occurredAt: createdAt.value
    });
    if (!auditRecords.ok) {
      return this.failure("ADLCase", "create", auditRecords.error);
    }

    return {
      success: true,
      caseView: this.toAdlCaseView(created.value),
      linkage: {
        riskCaseId,
        derivedCaseId: created.value.id,
        consistencyChecks: [this.toConsistencyCheckView(derivationRule.value)]
      },
      auditRecords: auditRecords.value.map((record) => this.toAuditRecordView(record))
    };
  }

  public async handleCoordinateRiskCaseAfterSubcaseTerminal(
    command: CoordinateRiskCaseAfterSubcaseTerminalCommand
  ): Promise<CoreCaseFlowResult> {
    const coordinatedAt = parseIsoUtcDate(command.coordinatedAt, "coordinatedAt");
    if (!coordinatedAt.ok) {
      return this.failure(command.subcaseType, "coordinate", coordinatedAt.error);
    }

    let traceId;
    let configVersion;
    try {
      traceId = createTraceId(command.traceId);
      configVersion = createConfigVersion(command.configVersion);
    } catch (error) {
      return this.failure(
        command.subcaseType,
        "coordinate",
        invalidApplicationCommandError("CoordinateRiskCaseAfterSubcaseTerminalCommand has invalid identifiers", {
          cause: error instanceof Error ? error.message : "unknown"
        })
      );
    }

    const loadedSubcase = await this.loadSubcaseForCoordination(command.subcaseType, command.subcaseId);
    if (!loadedSubcase.ok) {
      return loadedSubcase.error;
    }

    if (!this.isTerminalSubcaseState(command.subcaseType, loadedSubcase.value.state)) {
      return this.failure(
        command.subcaseType,
        "coordinate",
        invalidApplicationCommandError("Subcase terminal coordination requires a terminal subcase state", {
          subcaseType: command.subcaseType,
          subcaseId: loadedSubcase.value.id,
          currentSubcaseState: loadedSubcase.value.state
        })
      );
    }

    const loadedRiskCase = await this.loadRiskCaseOrFail(
      loadedSubcase.value.sourceRiskCaseId,
      command.subcaseType,
      "coordinate"
    );
    if (!loadedRiskCase.ok) {
      return loadedRiskCase.error;
    }

    const coordinated = await this.coordinateRiskCaseForSubcaseTerminal({
      subcaseType: command.subcaseType,
      subcaseId: loadedSubcase.value.id,
      subcaseTerminalState: loadedSubcase.value.state,
      subcaseUpdatedAt: loadedSubcase.value.updatedAt,
      riskCase: loadedRiskCase.value,
      traceId,
      reason: command.reason,
      triggeredBy: command.triggeredBy,
      configVersion,
      coordinatedAt: coordinatedAt.value,
      sourceOperation: "coordinate"
    });
    if (!coordinated.ok) {
      return coordinated.error;
    }

    const successResult: CoreCaseFlowResult = {
      success: true,
      caseView: this.toRiskCaseView(coordinated.value.riskCase, traceId),
      linkage: {
        riskCaseId: coordinated.value.riskCase.id,
        derivedCaseId: loadedSubcase.value.id,
        consistencyChecks: coordinated.value.consistencyChecks.map((rule) => this.toConsistencyCheckView(rule))
      },
      ...(coordinated.value.transition ? { transition: coordinated.value.transition } : {}),
      ...(coordinated.value.resolution ? { resolution: coordinated.value.resolution } : {}),
      auditRecords: coordinated.value.auditRecords.map((record) => this.toAuditRecordView(record))
    };
    return this.persistCoordinationReadView(successResult, "explicit_coordination_command");
  }

  public async handleTransitionRiskCase(command: TransitionRiskCaseCommand): Promise<CoreCaseFlowResult> {
    const transitionedAt = parseIsoUtcDate(command.transitionedAt, "transitionedAt");
    if (!transitionedAt.ok) {
      return this.failure("RiskCase", "transition", transitionedAt.error);
    }

    let riskCaseId;
    let traceId;
    let configVersion;
    try {
      riskCaseId = createRiskCaseId(command.caseId);
      traceId = createTraceId(command.traceId);
      configVersion = createConfigVersion(command.configVersion);
    } catch (error) {
      return this.failure(
        "RiskCase",
        "transition",
        invalidApplicationCommandError("TransitionRiskCaseCommand has invalid identifiers", {
          cause: error instanceof Error ? error.message : "unknown"
        })
      );
    }

    const loaded = await this.riskCaseRepository.getById(riskCaseId);
    if (!loaded.ok) {
      return this.failure(
        "RiskCase",
        "transition",
        dependencyFailureError("Failed to load RiskCase", {
          caseId: riskCaseId,
          message: loaded.error.message
        })
      );
    }
    if (loaded.value === null) {
      return this.failure(
        "RiskCase",
        "transition",
        resourceNotFoundError("RiskCase not found", {
          caseId: riskCaseId
        })
      );
    }

    const transitioned = this.riskCaseStateMachine.transition({
      riskCase: loaded.value,
      action: command.action,
      context: {
        traceId,
        reason: command.reason,
        triggeredBy: command.triggeredBy,
        configVersion,
        transitionedAt: transitionedAt.value
      }
    });
    if (!transitioned.ok) {
      return this.failure("RiskCase", "transition", fromDomainError(transitioned.error));
    }

    const saved = await this.riskCaseRepository.save(transitioned.value.riskCase);
    if (!saved.ok) {
      return this.failure(
        "RiskCase",
        "transition",
        dependencyFailureError("Failed to persist transitioned RiskCase", {
          caseId: riskCaseId,
          message: saved.error.message
        })
      );
    }

    const auditRecord = createCaseAuditRecord({
      caseType: CORE_CASE_AUDIT_TYPES.RiskCase,
      caseId: transitioned.value.riskCase.id,
      action: command.action,
      beforeState: transitioned.value.before.state,
      afterState: transitioned.value.after.state,
      reason: command.reason,
      traceId,
      occurredAt: transitionedAt.value
    });
    if (!auditRecord.ok) {
      return this.failure("RiskCase", "transition", fromDomainError(auditRecord.error));
    }

    return {
      success: true,
      caseView: this.toRiskCaseView(transitioned.value.riskCase, traceId),
      linkage: {
        riskCaseId: transitioned.value.riskCase.id,
        consistencyChecks: [
          {
            passed: true,
            rule: "risk_case_transition_self_consistent",
            detail: "RiskCase transition is evaluated against RiskCase state machine"
          }
        ]
      },
      transition: this.toTransitionView({
        action: command.action,
        beforeState: transitioned.value.before.state,
        afterState: transitioned.value.after.state,
        reason: command.reason,
        triggeredBy: command.triggeredBy,
        transitionedAt: transitionedAt.value
      }),
      auditRecords: [this.toAuditRecordView(auditRecord.value)]
    };
  }

  public async handleTransitionLiquidationCase(
    command: TransitionLiquidationCaseCommand
  ): Promise<CoreCaseFlowResult> {
    const transitionedAt = parseIsoUtcDate(command.transitionedAt, "transitionedAt");
    if (!transitionedAt.ok) {
      return this.failure("LiquidationCase", "transition", transitionedAt.error);
    }

    let liquidationCaseId;
    let traceId;
    let configVersion;
    try {
      liquidationCaseId = createLiquidationCaseId(command.liquidationCaseId);
      traceId = createTraceId(command.traceId);
      configVersion = createConfigVersion(command.configVersion);
    } catch (error) {
      return this.failure(
        "LiquidationCase",
        "transition",
        invalidApplicationCommandError("TransitionLiquidationCaseCommand has invalid identifiers", {
          cause: error instanceof Error ? error.message : "unknown"
        })
      );
    }

    const loaded = await this.liquidationCaseRepository.getById(liquidationCaseId);
    if (!loaded.ok) {
      return this.failure(
        "LiquidationCase",
        "transition",
        dependencyFailureError("Failed to load LiquidationCase", {
          caseId: liquidationCaseId,
          message: loaded.error.message
        })
      );
    }
    if (loaded.value === null) {
      return this.failure(
        "LiquidationCase",
        "transition",
        resourceNotFoundError("LiquidationCase not found", {
          caseId: liquidationCaseId
        })
      );
    }

    const parentRiskCase = await this.loadRiskCaseOrFail(
      loaded.value.sourceRiskCaseId,
      "LiquidationCase",
      "transition"
    );
    if (!parentRiskCase.ok) {
      return parentRiskCase.error;
    }

    const transitionConsistencyRule = this.ensureRiskCaseAllowsSpecialCaseTransition(
      parentRiskCase.value.state,
      "LiquidationCase",
      loaded.value.sourceRiskCaseId
    );
    if (!transitionConsistencyRule.ok) {
      return transitionConsistencyRule.error;
    }

    const transitioned = this.liquidationCaseStateMachine.transition({
      liquidationCase: loaded.value,
      action: command.action,
      context: {
        traceId,
        reason: command.reason,
        triggeredBy: command.triggeredBy,
        configVersion,
        transitionedAt: transitionedAt.value
      }
    });
    if (!transitioned.ok) {
      return this.failure("LiquidationCase", "transition", fromDomainError(transitioned.error));
    }

    const saved = await this.liquidationCaseRepository.save(transitioned.value.liquidationCase);
    if (!saved.ok) {
      return this.failure(
        "LiquidationCase",
        "transition",
        dependencyFailureError("Failed to persist transitioned LiquidationCase", {
          caseId: liquidationCaseId,
          message: saved.error.message
        })
      );
    }

    const auditRecord = createCaseAuditRecord({
      caseType: CORE_CASE_AUDIT_TYPES.LiquidationCase,
      caseId: transitioned.value.liquidationCase.id,
      action: command.action,
      beforeState: transitioned.value.before.state,
      afterState: transitioned.value.after.state,
      reason: command.reason,
      traceId,
      occurredAt: transitionedAt.value,
      relatedCaseType: CORE_CASE_AUDIT_TYPES.RiskCase,
      relatedCaseId: parentRiskCase.value.id
    });
    if (!auditRecord.ok) {
      return this.failure("LiquidationCase", "transition", fromDomainError(auditRecord.error));
    }

    const coordination = await this.coordinateRiskCaseForSubcaseTerminal({
      subcaseType: "LiquidationCase",
      subcaseId: transitioned.value.liquidationCase.id,
      subcaseTerminalState: transitioned.value.after.state,
      subcaseUpdatedAt: transitioned.value.liquidationCase.updatedAt,
      riskCase: parentRiskCase.value,
      traceId,
      reason: command.reason,
      triggeredBy: command.triggeredBy,
      configVersion,
      coordinatedAt: transitionedAt.value,
      sourceOperation: "transition"
    });
    if (!coordination.ok) {
      return coordination.error;
    }

    const consistencyChecks = [
      this.toConsistencyCheckView(transitionConsistencyRule.value),
      ...coordination.value.consistencyChecks.map((rule) => this.toConsistencyCheckView(rule))
    ];

    const auditRecords = [
      this.toAuditRecordView(auditRecord.value),
      ...coordination.value.auditRecords.map((record) => this.toAuditRecordView(record))
    ];

    const successResult: CoreCaseFlowResult = {
      success: true,
      caseView: this.toLiquidationCaseView(transitioned.value.liquidationCase),
      linkage: {
        riskCaseId: parentRiskCase.value.id,
        derivedCaseId: transitioned.value.liquidationCase.id,
        consistencyChecks
      },
      transition: this.toTransitionView({
        action: command.action,
        beforeState: transitioned.value.before.state,
        afterState: transitioned.value.after.state,
        reason: command.reason,
        triggeredBy: command.triggeredBy,
        transitionedAt: transitionedAt.value
      }),
      ...(coordination.value.resolution ? { resolution: coordination.value.resolution } : {}),
      auditRecords
    };
    return this.persistCoordinationReadView(successResult, "subcase_transition_auto_coordination");
  }

  public async handleTransitionADLCase(command: TransitionADLCaseCommand): Promise<CoreCaseFlowResult> {
    const transitionedAt = parseIsoUtcDate(command.transitionedAt, "transitionedAt");
    if (!transitionedAt.ok) {
      return this.failure("ADLCase", "transition", transitionedAt.error);
    }

    let adlCaseId;
    let traceId;
    let configVersion;
    try {
      adlCaseId = createADLCaseId(command.adlCaseId);
      traceId = createTraceId(command.traceId);
      configVersion = createConfigVersion(command.configVersion);
    } catch (error) {
      return this.failure(
        "ADLCase",
        "transition",
        invalidApplicationCommandError("TransitionADLCaseCommand has invalid identifiers", {
          cause: error instanceof Error ? error.message : "unknown"
        })
      );
    }

    const loaded = await this.adlCaseRepository.getById(adlCaseId);
    if (!loaded.ok) {
      return this.failure(
        "ADLCase",
        "transition",
        dependencyFailureError("Failed to load ADLCase", {
          caseId: adlCaseId,
          message: loaded.error.message
        })
      );
    }
    if (loaded.value === null) {
      return this.failure(
        "ADLCase",
        "transition",
        resourceNotFoundError("ADLCase not found", {
          caseId: adlCaseId
        })
      );
    }

    const parentRiskCase = await this.loadRiskCaseOrFail(loaded.value.sourceRiskCaseId, "ADLCase", "transition");
    if (!parentRiskCase.ok) {
      return parentRiskCase.error;
    }

    const transitionConsistencyRule = this.ensureRiskCaseAllowsSpecialCaseTransition(
      parentRiskCase.value.state,
      "ADLCase",
      loaded.value.sourceRiskCaseId
    );
    if (!transitionConsistencyRule.ok) {
      return transitionConsistencyRule.error;
    }

    const transitioned = this.adlCaseStateMachine.transition({
      adlCase: loaded.value,
      action: command.action,
      context: {
        traceId,
        reason: command.reason,
        triggeredBy: command.triggeredBy,
        configVersion,
        transitionedAt: transitionedAt.value
      }
    });
    if (!transitioned.ok) {
      return this.failure("ADLCase", "transition", fromDomainError(transitioned.error));
    }

    const saved = await this.adlCaseRepository.save(transitioned.value.adlCase);
    if (!saved.ok) {
      return this.failure(
        "ADLCase",
        "transition",
        dependencyFailureError("Failed to persist transitioned ADLCase", {
          caseId: adlCaseId,
          message: saved.error.message
        })
      );
    }

    const auditRecord = createCaseAuditRecord({
      caseType: CORE_CASE_AUDIT_TYPES.ADLCase,
      caseId: transitioned.value.adlCase.id,
      action: command.action,
      beforeState: transitioned.value.before.state,
      afterState: transitioned.value.after.state,
      reason: command.reason,
      traceId,
      occurredAt: transitionedAt.value,
      relatedCaseType: CORE_CASE_AUDIT_TYPES.RiskCase,
      relatedCaseId: parentRiskCase.value.id
    });
    if (!auditRecord.ok) {
      return this.failure("ADLCase", "transition", fromDomainError(auditRecord.error));
    }

    const coordination = await this.coordinateRiskCaseForSubcaseTerminal({
      subcaseType: "ADLCase",
      subcaseId: transitioned.value.adlCase.id,
      subcaseTerminalState: transitioned.value.after.state,
      subcaseUpdatedAt: transitioned.value.adlCase.updatedAt,
      riskCase: parentRiskCase.value,
      traceId,
      reason: command.reason,
      triggeredBy: command.triggeredBy,
      configVersion,
      coordinatedAt: transitionedAt.value,
      sourceOperation: "transition"
    });
    if (!coordination.ok) {
      return coordination.error;
    }

    const consistencyChecks = [
      this.toConsistencyCheckView(transitionConsistencyRule.value),
      ...coordination.value.consistencyChecks.map((rule) => this.toConsistencyCheckView(rule))
    ];

    const auditRecords = [
      this.toAuditRecordView(auditRecord.value),
      ...coordination.value.auditRecords.map((record) => this.toAuditRecordView(record))
    ];

    const successResult: CoreCaseFlowResult = {
      success: true,
      caseView: this.toAdlCaseView(transitioned.value.adlCase),
      linkage: {
        riskCaseId: parentRiskCase.value.id,
        derivedCaseId: transitioned.value.adlCase.id,
        consistencyChecks
      },
      transition: this.toTransitionView({
        action: command.action,
        beforeState: transitioned.value.before.state,
        afterState: transitioned.value.after.state,
        reason: command.reason,
        triggeredBy: command.triggeredBy,
        transitionedAt: transitionedAt.value
      }),
      ...(coordination.value.resolution ? { resolution: coordination.value.resolution } : {}),
      auditRecords
    };
    return this.persistCoordinationReadView(successResult, "subcase_transition_auto_coordination");
  }

  private async loadRiskCaseOrFail(
    riskCaseId: ReturnType<typeof createRiskCaseId>,
    caseType: "LiquidationCase" | "ADLCase",
    operation: "create" | "transition" | "coordinate"
  ): Promise<Result<RiskCase, CoreCaseFlowResult>> {
    const loaded = await this.riskCaseRepository.getById(riskCaseId);
    if (!loaded.ok) {
      return {
        ok: false,
        error: this.failure(
          caseType,
          operation,
          dependencyFailureError("Failed to load source RiskCase", {
            caseId: riskCaseId,
            message: loaded.error.message
          })
        )
      };
    }
    if (loaded.value === null) {
      return {
        ok: false,
        error: this.failure(
          caseType,
          operation,
          resourceNotFoundError("Source RiskCase not found", {
            caseId: riskCaseId
          })
        )
      };
    }
    return { ok: true, value: loaded.value };
  }

  private ensureRiskCaseAllowsDerivation(
    riskCaseState: RiskCase["state"],
    caseType: "LiquidationCase" | "ADLCase",
    riskCaseId: string
  ): Result<LinkageConsistencyRuleResult, CoreCaseFlowResult> {
    if (!isRiskCaseStateAllowedForDerivation(riskCaseState)) {
      return {
        ok: false,
        error: this.failure(
          caseType,
          "create",
          invalidApplicationCommandError("RiskCase state does not allow deriving special case", {
            caseId: riskCaseId,
            currentState: riskCaseState
          })
        )
      };
    }
    return {
      ok: true,
      value: {
        passed: true,
        rule: "risk_case_state_allows_special_case_derivation",
        detail: `RiskCase state ${riskCaseState} allows creating derived ${caseType}`
      }
    };
  }

  private ensureRiskCaseAllowsSpecialCaseTransition(
    riskCaseState: RiskCase["state"],
    caseType: "LiquidationCase" | "ADLCase",
    riskCaseId: string
  ): Result<LinkageConsistencyRuleResult, CoreCaseFlowResult> {
    if (!isRiskCaseStateAllowedForSpecialCaseTransition(riskCaseState)) {
      return {
        ok: false,
        error: this.failure(
          caseType,
          "transition",
          invalidApplicationCommandError("RiskCase state is inconsistent with special case transition", {
            caseId: riskCaseId,
            currentState: riskCaseState
          })
        )
      };
    }
    return {
      ok: true,
      value: {
        passed: true,
        rule: "risk_case_state_allows_special_case_transition",
        detail: `RiskCase state ${riskCaseState} allows transitioning ${caseType}`
      }
    };
  }

  private async loadSubcaseForCoordination(
    subcaseType: CoreSubcaseKind,
    subcaseId: string
  ): Promise<
    Result<
      {
        readonly id: string;
        readonly sourceRiskCaseId: ReturnType<typeof createRiskCaseId>;
        readonly state: string;
        readonly updatedAt: Date;
      },
      CoreCaseFlowResult
    >
  > {
    if (subcaseType === "LiquidationCase") {
      let liquidationCaseId;
      try {
        liquidationCaseId = createLiquidationCaseId(subcaseId);
      } catch (error) {
        return {
          ok: false,
          error: this.failure(
            "LiquidationCase",
            "coordinate",
            invalidApplicationCommandError("Coordinate command has invalid LiquidationCase identifier", {
              cause: error instanceof Error ? error.message : "unknown"
            })
          )
        };
      }
      const loaded = await this.liquidationCaseRepository.getById(liquidationCaseId);
      if (!loaded.ok) {
        return {
          ok: false,
          error: this.failure(
            "LiquidationCase",
            "coordinate",
            dependencyFailureError("Failed to load LiquidationCase for coordination", {
              caseId: liquidationCaseId,
              message: loaded.error.message
            })
          )
        };
      }
      if (loaded.value === null) {
        return {
          ok: false,
          error: this.failure(
            "LiquidationCase",
            "coordinate",
            resourceNotFoundError("LiquidationCase not found", {
              caseId: liquidationCaseId
            })
          )
        };
      }
      return {
        ok: true,
        value: {
          id: loaded.value.id,
          sourceRiskCaseId: loaded.value.sourceRiskCaseId,
          state: loaded.value.state,
          updatedAt: loaded.value.updatedAt
        }
      };
    }

    let adlCaseId;
    try {
      adlCaseId = createADLCaseId(subcaseId);
    } catch (error) {
      return {
        ok: false,
        error: this.failure(
          "ADLCase",
          "coordinate",
          invalidApplicationCommandError("Coordinate command has invalid ADLCase identifier", {
            cause: error instanceof Error ? error.message : "unknown"
          })
        )
      };
    }
    const loaded = await this.adlCaseRepository.getById(adlCaseId);
    if (!loaded.ok) {
      return {
        ok: false,
        error: this.failure(
          "ADLCase",
          "coordinate",
          dependencyFailureError("Failed to load ADLCase for coordination", {
            caseId: adlCaseId,
            message: loaded.error.message
          })
        )
      };
    }
    if (loaded.value === null) {
      return {
        ok: false,
        error: this.failure(
          "ADLCase",
          "coordinate",
          resourceNotFoundError("ADLCase not found", {
            caseId: adlCaseId
          })
        )
      };
    }
    return {
      ok: true,
      value: {
        id: loaded.value.id,
        sourceRiskCaseId: loaded.value.sourceRiskCaseId,
        state: loaded.value.state,
        updatedAt: loaded.value.updatedAt
      }
    };
  }

  private isTerminalSubcaseState(subcaseType: CoreSubcaseKind, state: string): boolean {
    if (subcaseType === "LiquidationCase") {
      return state === LiquidationCaseState.Completed || state === LiquidationCaseState.Failed;
    }
    return state === ADLCaseState.Executed || state === ADLCaseState.Failed;
  }

  private resolveRiskCaseResolutionPlan(
    subcaseType: CoreSubcaseKind,
    context: RiskCaseSubcaseCoordinationContext,
    riskCaseState: CaseState,
    ordering: SubcaseTerminalSignalOrdering
  ): RiskCaseResolutionPlan {
    let selectedAction: RiskCaseResolutionAction;
    let riskCaseTransitionApplied = false;
    let decision: RiskCaseResolutionPlan["decision"] = "deferred";
    let transitionAction: TransitionAction | undefined;
    let arbitrationRule = "default_under_review";
    let detail = "Default terminal coordination keeps RiskCase under review";

    if (context.terminalFailureSignalCount > 0) {
      selectedAction = RiskCaseResolutionAction.MarkRiskCaseManualInterventionRequiredAfterSubcaseFailure;
      riskCaseTransitionApplied = true;
      decision = "applied";
      transitionAction = TransitionAction.RequestManualIntervention;
      arbitrationRule = context.conflictDetected
        ? "failure_signal_priority_over_success_signal"
        : "failure_signal_requires_manual_intervention";
      detail = context.conflictDetected
        ? "Conflict detected across terminal signals; manual-intervention action has higher priority"
        : "Failure terminal signal requires manual-intervention coordination";
    } else {
      if (riskCaseState === CaseState.Closed) {
        selectedAction = RiskCaseResolutionAction.MarkRiskCaseResolvedAfterSubcaseCompletion;
        riskCaseTransitionApplied = false;
        decision = "duplicate";
        arbitrationRule = "closed_state_completion_signal_deduplicated";
        detail = "RiskCase is already closed; completion signal is deduplicated";
      } else {
      const closeAvailable = riskCaseState === CaseState.Classified || riskCaseState === CaseState.Settling;
      if (context.hasOtherActiveSubcases || !closeAvailable) {
        selectedAction = RiskCaseResolutionAction.MarkRiskCaseUnderReviewAfterSubcaseCompletion;
        riskCaseTransitionApplied = false;
        decision = "deferred";
        arbitrationRule = context.hasOtherActiveSubcases
          ? "active_subcase_blocks_direct_close"
          : "close_transition_not_available_for_current_risk_state";
        detail = context.hasOtherActiveSubcases
          ? "Other active subcase exists; RiskCase close is deferred to keep ordering explainable"
          : "No higher-priority failure signal exists, but current RiskCase state does not allow close transition";
      } else {
        selectedAction = RiskCaseResolutionAction.MarkRiskCaseResolvedAfterSubcaseCompletion;
        riskCaseTransitionApplied = true;
        decision = "applied";
        transitionAction = TransitionAction.Close;
        arbitrationRule = "all_subcases_terminal_success_and_close_allowed";
        detail = "No failure signal and no active subcase; RiskCase can be closed by terminal completion";
      }
      }
    }

    const selectedPriority = getResolutionPriority(selectedAction);
    const currentPriority = getRiskCaseCurrentPriority(riskCaseState);

    if (ordering.category === "late") {
      if (selectedPriority <= currentPriority) {
        return {
          action: selectedAction,
          riskCaseTransitionApplied: false,
          decision: "ignored",
          selectedPriority,
          arbitrationRule: "late_lower_priority_signal_ignored",
          detail: "Late signal is ignored because newer/higher-priority coordination already exists"
        };
      }
      if (
        selectedAction === RiskCaseResolutionAction.MarkRiskCaseManualInterventionRequiredAfterSubcaseFailure &&
        riskCaseState !== CaseState.Closed &&
        riskCaseState !== CaseState.Failed &&
        riskCaseState !== CaseState.ManualInterventionRequired
      ) {
        return {
          action: selectedAction,
          transitionAction: TransitionAction.RequestManualIntervention,
          riskCaseTransitionApplied: true,
          decision: "applied",
          selectedPriority,
          arbitrationRule: "late_higher_priority_conservative_escalation_allowed",
          detail: "Late but more conservative failure signal is allowed to escalate RiskCase"
        };
      }
      return {
        action: selectedAction,
        riskCaseTransitionApplied: false,
        decision: "rejected",
        selectedPriority,
        arbitrationRule: "late_signal_rejected_by_replay_boundary",
        detail: "Late signal is rejected by minimal replay/ordering boundary"
      };
    }

    if (ordering.category === "replayed") {
      if (selectedPriority <= currentPriority) {
        return {
          action: selectedAction,
          riskCaseTransitionApplied: false,
          decision: "duplicate",
          selectedPriority,
          arbitrationRule: "replayed_equivalent_or_lower_priority_signal_deduplicated",
          detail: "Replay signal is deduplicated because equivalent/higher-priority result already exists"
        };
      }
      if (
        selectedAction === RiskCaseResolutionAction.MarkRiskCaseManualInterventionRequiredAfterSubcaseFailure &&
        riskCaseState !== CaseState.Closed &&
        riskCaseState !== CaseState.Failed &&
        riskCaseState !== CaseState.ManualInterventionRequired
      ) {
        return {
          action: selectedAction,
          transitionAction: TransitionAction.RequestManualIntervention,
          riskCaseTransitionApplied: true,
          decision: "applied",
          selectedPriority,
          arbitrationRule: "replayed_conservative_escalation_allowed",
          detail: "Replay signal is accepted because it upgrades to conservative manual intervention"
        };
      }
      return {
        action: selectedAction,
        riskCaseTransitionApplied: false,
        decision: "rejected",
        selectedPriority,
        arbitrationRule: "replayed_signal_rejected",
        detail: "Replay signal is rejected by minimal idempotent replay boundary"
      };
    }

    if (currentPriority > selectedPriority) {
      return {
        action: selectedAction,
        riskCaseTransitionApplied: false,
        decision: "rejected",
        selectedPriority,
        arbitrationRule: "lower_priority_terminal_signal_rejected_after_higher_priority_resolution",
        detail: `Current RiskCase state ${riskCaseState} already reflects higher-priority resolution`
      };
    }
    if (
      currentPriority === selectedPriority &&
      (riskCaseState === CaseState.Closed || riskCaseState === CaseState.ManualInterventionRequired)
    ) {
      return {
        action: selectedAction,
        riskCaseTransitionApplied: false,
        decision: "duplicate",
        selectedPriority,
        arbitrationRule: "duplicate_terminal_signal_deduplicated",
        detail: `Current RiskCase state ${riskCaseState} already applied equivalent terminal coordination`
      };
    }

    if (
      selectedAction === RiskCaseResolutionAction.MarkRiskCaseManualInterventionRequiredAfterSubcaseFailure &&
      (riskCaseState === CaseState.Closed || riskCaseState === CaseState.Failed)
    ) {
      return {
        action: selectedAction,
        riskCaseTransitionApplied: false,
        decision: "rejected",
        selectedPriority,
        arbitrationRule: "risk_case_terminal_state_blocks_manual_override",
        detail: `RiskCase terminal state ${riskCaseState} blocks manual-intervention override`
      };
    }

    return {
      action: selectedAction,
      ...(transitionAction ? { transitionAction } : {}),
      riskCaseTransitionApplied,
      decision,
      selectedPriority,
      arbitrationRule,
      detail
    };
  }

  private async buildCoordinationContext(
    riskCaseId: ReturnType<typeof createRiskCaseId>,
    triggerSignal: {
      readonly subcaseType: CoreSubcaseKind;
      readonly subcaseId: string;
      readonly subcaseState: string;
    },
    sourceSubcaseType: CoreSubcaseKind
  ): Promise<Result<RiskCaseSubcaseCoordinationContext, CoreCaseFlowResult>> {
    const liquidationCases = await this.liquidationCaseRepository.listBySourceRiskCaseId(riskCaseId);
    if (!liquidationCases.ok) {
      return {
        ok: false,
        error: this.failure(
          sourceSubcaseType,
          "coordinate",
          dependencyFailureError("Failed to load sibling LiquidationCase list for coordination", {
            caseId: riskCaseId,
            message: liquidationCases.error.message
          })
        )
      };
    }
    const adlCases = await this.adlCaseRepository.listBySourceRiskCaseId(riskCaseId);
    if (!adlCases.ok) {
      return {
        ok: false,
        error: this.failure(
          sourceSubcaseType,
          "coordinate",
          dependencyFailureError("Failed to load sibling ADLCase list for coordination", {
            caseId: riskCaseId,
            message: adlCases.error.message
          })
        )
      };
    }

    return {
      ok: true,
      value: buildRiskCaseSubcaseCoordinationContext({
        triggerSignal,
        liquidationCases: liquidationCases.value,
        adlCases: adlCases.value
      })
    };
  }

  private async coordinateRiskCaseForSubcaseTerminal(input: {
    readonly subcaseType: CoreSubcaseKind;
    readonly subcaseId: string;
    readonly subcaseTerminalState: string;
    readonly subcaseUpdatedAt: Date;
    readonly riskCase: RiskCase;
    readonly traceId: ReturnType<typeof createTraceId>;
    readonly reason: string;
    readonly triggeredBy: "system" | "manual";
    readonly configVersion: ReturnType<typeof createConfigVersion>;
    readonly coordinatedAt: Date;
    readonly sourceOperation: "transition" | "coordinate";
  }): Promise<
    Result<
      {
        readonly riskCase: RiskCase;
        readonly consistencyChecks: readonly LinkageConsistencyRuleResult[];
        readonly transition?: CoreCaseTransitionView;
        readonly resolution?: CoreCaseResolutionView;
        readonly auditRecords: readonly CaseAuditRecord[];
      },
      CoreCaseFlowResult
    >
  > {
    if (!this.isTerminalSubcaseState(input.subcaseType, input.subcaseTerminalState)) {
      if (input.sourceOperation === "transition") {
        return {
          ok: true,
          value: {
            riskCase: input.riskCase,
            consistencyChecks: [],
            auditRecords: []
          }
        };
      }
      return {
        ok: false,
        error: this.failure(
          input.subcaseType,
          "coordinate",
          invalidApplicationCommandError("Subcase terminal coordination requires terminal state", {
            subcaseType: input.subcaseType,
            subcaseId: input.subcaseId,
            subcaseState: input.subcaseTerminalState
          })
        )
      };
    }

    if (input.configVersion !== input.riskCase.configVersion) {
      return {
        ok: false,
        error: this.failure(
          input.subcaseType,
          "coordinate",
          invalidApplicationCommandError("RiskCase config version mismatch for terminal coordination", {
            caseConfigVersion: `${input.riskCase.configVersion}`,
            commandConfigVersion: `${input.configVersion}`
          })
        )
      };
    }

    const context = await this.buildCoordinationContext(
      input.riskCase.id,
      {
        subcaseType: input.subcaseType,
        subcaseId: input.subcaseId,
        subcaseState: input.subcaseTerminalState
      },
      input.subcaseType
    );
    if (!context.ok) {
      return context;
    }

    const ordering = buildSubcaseTerminalSignalOrdering({
      signalOccurredAt: input.coordinatedAt,
      subcaseLastUpdatedAt: input.subcaseUpdatedAt,
      riskCaseLastUpdatedAt: input.riskCase.updatedAt,
      sourceOperation: input.sourceOperation
    });

    const plan = this.resolveRiskCaseResolutionPlan(input.subcaseType, context.value, input.riskCase.state, ordering);
    const signalCategory = plan.decision === "duplicate" ? "duplicate" : ordering.category;

    let nextRiskCase = input.riskCase;
    let transitionView: CoreCaseTransitionView | undefined;
    const riskCaseTransitionedAt =
      input.coordinatedAt.getTime() < input.riskCase.updatedAt.getTime()
        ? input.riskCase.updatedAt
        : input.coordinatedAt;

    if (plan.riskCaseTransitionApplied) {
      const transitionAction = plan.transitionAction;
      if (!transitionAction) {
        return {
          ok: false,
          error: this.failure(
            input.subcaseType,
            "coordinate",
            invalidApplicationCommandError("RiskCase transition action is missing for applied terminal coordination", {
              action: plan.action
            })
          )
        };
      }
      const transitioned = this.riskCaseStateMachine.transition({
        riskCase: input.riskCase,
        action: transitionAction,
        context: {
          traceId: input.traceId,
          reason: input.reason,
          triggeredBy: input.triggeredBy,
          configVersion: input.configVersion,
          transitionedAt: riskCaseTransitionedAt
        }
      });
      if (!transitioned.ok) {
        return {
          ok: false,
          error: this.failure(input.subcaseType, "coordinate", fromDomainError(transitioned.error))
        };
      }

      const savedRisk = await this.riskCaseRepository.save(transitioned.value.riskCase);
      if (!savedRisk.ok) {
        return {
          ok: false,
          error: this.failure(
            input.subcaseType,
            "coordinate",
            dependencyFailureError("Failed to persist RiskCase coordinated by subcase terminal state", {
              caseId: transitioned.value.riskCase.id,
              message: savedRisk.error.message
            })
          )
        };
      }

      nextRiskCase = transitioned.value.riskCase;
      transitionView = this.toTransitionView({
        action: transitionAction,
        beforeState: transitioned.value.before.state,
        afterState: transitioned.value.after.state,
        reason: input.reason,
        triggeredBy: input.triggeredBy,
        transitionedAt: riskCaseTransitionedAt
      });
    }

    const riskCoordinationAudit = createCaseAuditRecord({
      caseType: CORE_CASE_AUDIT_TYPES.RiskCase,
      caseId: nextRiskCase.id,
      action: plan.action,
      beforeState: input.riskCase.state,
      afterState: nextRiskCase.state,
      reason: input.reason,
      traceId: input.traceId,
      occurredAt: riskCaseTransitionedAt,
      relatedCaseType: input.subcaseType,
      relatedCaseId: input.subcaseId,
      context: {
        ...toCoordinationContextAuditFields(context.value, plan.arbitrationRule),
        arbitration_decision: plan.decision,
        selected_priority: `${plan.selectedPriority}`,
        signal_category: signalCategory,
        signal_reason: ordering.reason,
        signal_occurred_at: ordering.signalOccurredAt.toISOString(),
        subcase_last_updated_at: ordering.subcaseLastUpdatedAt.toISOString(),
        risk_case_last_updated_at: ordering.riskCaseLastUpdatedAt.toISOString()
      }
    });
    if (!riskCoordinationAudit.ok) {
      return {
        ok: false,
        error: this.failure(input.subcaseType, "coordinate", fromDomainError(riskCoordinationAudit.error))
      };
    }

    return {
      ok: true,
      value: {
        riskCase: nextRiskCase,
        consistencyChecks: [
          {
            passed: true,
            rule: "subcase_terminal_state_triggers_risk_case_resolution",
            detail: plan.detail
          }
        ],
        ...(transitionView ? { transition: transitionView } : {}),
        resolution: {
          subcaseType: input.subcaseType,
          subcaseId: input.subcaseId,
          subcaseTerminalState: input.subcaseTerminalState,
          action: plan.action,
          riskCaseId: nextRiskCase.id,
          beforeState: input.riskCase.state,
          afterState: nextRiskCase.state,
          riskCaseTransitionApplied: plan.riskCaseTransitionApplied,
          decision: plan.decision,
          hasOtherSubcases: context.value.snapshots.length > 1,
          hasOtherActiveSubcases: context.value.hasOtherActiveSubcases,
          conflictDetected: context.value.conflictDetected,
          selectedPriority: plan.selectedPriority,
          arbitrationRule: plan.arbitrationRule,
          signalCategory,
          signalReason: ordering.reason,
          signalOccurredAt: ordering.signalOccurredAt.toISOString(),
          subcaseLastUpdatedAt: ordering.subcaseLastUpdatedAt.toISOString(),
          riskCaseLastUpdatedAt: ordering.riskCaseLastUpdatedAt.toISOString()
        },
        auditRecords: [riskCoordinationAudit.value]
      }
    };
  }

  private createAuditRecordsForDerivedCaseCreate(input: {
    readonly caseType: CoreCaseAuditType;
    readonly caseId: string;
    readonly relatedRiskCaseId: string;
    readonly sourceRiskCaseState: RiskCase["state"];
    readonly action: string;
    readonly reason: string;
    readonly traceId: ReturnType<typeof createTraceId>;
    readonly occurredAt: Date;
  }): Result<readonly CaseAuditRecord[], ApplicationError> {
    const derivedCaseAudit = createCaseAuditRecord({
      caseType: input.caseType,
      caseId: input.caseId,
      action: input.action,
      beforeState: "NotCreated",
      afterState: "Initiated",
      reason: input.reason,
      traceId: input.traceId,
      occurredAt: input.occurredAt,
      relatedCaseType: CORE_CASE_AUDIT_TYPES.RiskCase,
      relatedCaseId: input.relatedRiskCaseId
    });
    if (!derivedCaseAudit.ok) {
      return {
        ok: false,
        error: fromDomainError(derivedCaseAudit.error)
      };
    }

    const riskLinkageAudit = createCaseAuditRecord({
      caseType: CORE_CASE_AUDIT_TYPES.RiskCase,
      caseId: input.relatedRiskCaseId,
      action: `Derive${input.caseType}`,
      beforeState: input.sourceRiskCaseState,
      afterState: input.sourceRiskCaseState,
      reason: input.reason,
      traceId: input.traceId,
      occurredAt: input.occurredAt,
      relatedCaseType: input.caseType,
      relatedCaseId: input.caseId
    });
    if (!riskLinkageAudit.ok) {
      return {
        ok: false,
        error: fromDomainError(riskLinkageAudit.error)
      };
    }

    return {
      ok: true,
      value: [derivedCaseAudit.value, riskLinkageAudit.value]
    };
  }

  private async persistCoordinationReadView(
    result: CoreCaseFlowResult,
    sourceCommandPath: CoordinationSourceCommandPath
  ): Promise<CoreCaseFlowResult> {
    if (!result.success || !result.resolution) {
      return result;
    }

    const projected = projectCoreCaseFlowResultToCoordinationResultView({
      result,
      sourceCommandPath
    });
    if (!projected.ok) {
      await this.emitCoordinationObservation(
        buildCoordinationResultObservation({
          scope: "persistence",
          riskCaseId: result.linkage.riskCaseId,
          persistenceWriteFailed: true
        })
      );
      return this.failure(result.caseView.caseType, "coordinate", projected.error);
    }

    const recorded = this.coordinationResultRegistry.record(projected.value);
    if (!recorded.ok) {
      await this.emitCoordinationObservation(
        buildCoordinationResultObservation({
          scope: "persistence",
          riskCaseId: projected.value.riskCaseId,
          factKey: mapCoordinationResultViewToStoredRecord(projected.value).factKey,
          validationFailed: true
        })
      );
      return this.failure(result.caseView.caseType, "coordinate", recorded.error);
    }

    if (!this.coordinationResultStore) {
      return result;
    }

    const storedRecord = mapCoordinationResultViewToStoredRecord(projected.value);
    const existingLookup = await this.coordinationResultStore.getByFactKey(storedRecord.factKey);
    if (!existingLookup.ok) {
      await this.emitCoordinationObservation(
        buildCoordinationResultObservation({
          scope: "persistence",
          riskCaseId: projected.value.riskCaseId,
          subcaseType: projected.value.subcaseType,
          subcaseId: projected.value.subcaseId,
          factKey: storedRecord.factKey,
          persistenceWriteFailed: true
        })
      );
      return this.failure(
        result.caseView.caseType,
        "coordinate",
        dependencyFailureError("Failed to load existing persisted coordination result by factKey", {
          factKey: storedRecord.factKey,
          message: existingLookup.error.message
        })
      );
    }
    if (existingLookup.value.status === "found") {
      const replayValidation = validateCoordinationResultReplayCompatibility({
        storedRecord: existingLookup.value.record,
        currentAuditSummary: projected.value.auditRecordSummary
      });
      if (!replayValidation.ok) {
        await this.emitCoordinationObservation(
          buildCoordinationResultObservation({
            scope: "persistence",
            riskCaseId: projected.value.riskCaseId,
            subcaseType: projected.value.subcaseType,
            subcaseId: projected.value.subcaseId,
            factKey: storedRecord.factKey,
            storeReadHit: true,
            validationFailed: true
          })
        );
        return this.failure(result.caseView.caseType, "coordinate", replayValidation.error);
      }
      const existingView = mapStoredCoordinationResultToReadView(existingLookup.value.record);
      const consistency = assertCoordinationResultViewsConsistent(existingView, projected.value);
      if (!consistency.ok) {
        await this.emitCoordinationObservation(
          buildCoordinationResultObservation({
            scope: "persistence",
            riskCaseId: projected.value.riskCaseId,
            subcaseType: projected.value.subcaseType,
            subcaseId: projected.value.subcaseId,
            factKey: storedRecord.factKey,
            storeReadHit: true,
            validationFailed: true
          })
        );
        return this.failure(
          result.caseView.caseType,
          "coordinate",
          invalidApplicationCommandError("Persisted coordination result conflicts with current write-path view", {
            reason: consistency.reason,
            ...consistency.details
          })
        );
      }
      await this.emitCoordinationObservation(
        buildCoordinationResultObservation({
          scope: "persistence",
          riskCaseId: projected.value.riskCaseId,
          subcaseType: projected.value.subcaseType,
          subcaseId: projected.value.subcaseId,
          factKey: storedRecord.factKey,
          storeReadHit: true,
          validationPassed: true
        })
      );
      return result;
    }

    const persisted = await this.coordinationResultStore.put(storedRecord);
    if (!persisted.ok) {
      await this.emitCoordinationObservation(
        buildCoordinationResultObservation({
          scope: "persistence",
          riskCaseId: projected.value.riskCaseId,
          subcaseType: projected.value.subcaseType,
          subcaseId: projected.value.subcaseId,
          factKey: storedRecord.factKey,
          persistenceWriteFailed: true
        })
      );
      return this.failure(
        result.caseView.caseType,
        "coordinate",
        dependencyFailureError("Failed to persist coordination result read view", {
          factKey: storedRecord.factKey,
          message: persisted.error.message
        })
      );
    }

    await this.emitCoordinationObservation(
      buildCoordinationResultObservation({
        scope: "persistence",
        riskCaseId: projected.value.riskCaseId,
        subcaseType: projected.value.subcaseType,
        subcaseId: projected.value.subcaseId,
        factKey: storedRecord.factKey,
        persistenceWriteSucceeded: true
      })
    );
    return result;
  }

  private async emitCoordinationObservation(
    observation: ReturnType<typeof buildCoordinationResultObservation>
  ): Promise<void> {
    this.coordinationObservationRegistry.record(observation);
    if (!this.coordinationMetricsSink) {
      return;
    }
    await this.coordinationMetricsSink.record(observation);
  }

  private toConsistencyCheckView(input: LinkageConsistencyRuleResult): CoreCaseConsistencyCheckView {
    return {
      passed: input.passed,
      rule: input.rule,
      detail: input.detail
    };
  }

  private toRiskCaseView(riskCase: RiskCase, traceId: ReturnType<typeof createTraceId>): CoreCaseView {
    return {
      caseType: "RiskCase",
      caseId: riskCase.id,
      state: riskCase.state,
      configVersion: riskCase.configVersion,
      traceId,
      createdAt: riskCase.createdAt.toISOString(),
      updatedAt: riskCase.updatedAt.toISOString()
    };
  }

  private toLiquidationCaseView(liquidationCase: LiquidationCase): CoreCaseView {
    return {
      caseType: "LiquidationCase",
      caseId: liquidationCase.id,
      state: liquidationCase.state,
      configVersion: liquidationCase.configVersion,
      traceId: liquidationCase.traceId,
      sourceRiskCaseId: liquidationCase.sourceRiskCaseId,
      createdAt: liquidationCase.createdAt.toISOString(),
      updatedAt: liquidationCase.updatedAt.toISOString()
    };
  }

  private toAdlCaseView(adlCase: ADLCase): CoreCaseView {
    return {
      caseType: "ADLCase",
      caseId: adlCase.id,
      state: adlCase.state,
      configVersion: adlCase.configVersion,
      traceId: adlCase.traceId,
      sourceRiskCaseId: adlCase.sourceRiskCaseId,
      createdAt: adlCase.createdAt.toISOString(),
      updatedAt: adlCase.updatedAt.toISOString()
    };
  }

  private toTransitionView(input: {
    readonly action: string;
    readonly beforeState: string;
    readonly afterState: string;
    readonly reason: string;
    readonly triggeredBy: "system" | "manual";
    readonly transitionedAt: Date;
  }): CoreCaseTransitionView {
    return {
      action: input.action,
      beforeState: input.beforeState,
      afterState: input.afterState,
      reason: input.reason,
      triggeredBy: input.triggeredBy,
      transitionedAt: input.transitionedAt.toISOString()
    };
  }

  private toAuditRecordView(input: CaseAuditRecord): CoreCaseAuditRecordView {
    return {
      auditId: input.auditId,
      caseType: input.caseType,
      caseId: input.caseId,
      action: input.action,
      beforeState: input.beforeState,
      afterState: input.afterState,
      reason: input.reason,
      traceId: input.traceId,
      occurredAt: input.occurredAt.toISOString(),
      ...(input.relatedCaseType ? { relatedCaseType: input.relatedCaseType } : {}),
      ...(input.relatedCaseId ? { relatedCaseId: input.relatedCaseId } : {}),
      ...(input.context ? { context: { ...input.context } } : {})
    };
  }

  private failure(
    caseType: "RiskCase" | "LiquidationCase" | "ADLCase",
    operation: "create" | "transition" | "coordinate",
    error: ApplicationError
  ): CoreCaseFlowResult {
    return {
      success: false,
      caseType,
      operation,
      error
    };
  }
}
