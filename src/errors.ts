import type { ErrorContext } from './types';

export enum ErrorSeverity {
  WARNING = 'WARNING',
  RECOVERABLE = 'RECOVERABLE',
  FATAL = 'FATAL',
}

export class SyncError extends Error {
  public readonly severity: ErrorSeverity;
  public readonly operation?: string;
  public readonly path?: string;
  public readonly context?: Record<string, unknown>;

  constructor(
    message: string,
    severity: ErrorSeverity,
    context?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'SyncError';
    this.severity = severity;
    this.context = context;
  }
}

export class AtomicWriteError extends SyncError {
  public readonly operation: string;
  public readonly path: string;

  constructor(message: string, context: ErrorContext) {
    super(message, ErrorSeverity.FATAL, {
      operation: context.operation,
      path: context.path,
    });
    this.name = 'AtomicWriteError';
    this.operation = context.operation;
    this.path = context.path;
    this.cause = context.cause;
  }
}

export class HashError extends SyncError {
  public readonly operation: string;
  public readonly path: string;

  constructor(message: string, context: ErrorContext) {
    super(message, ErrorSeverity.RECOVERABLE, {
      operation: context.operation,
      path: context.path,
    });
    this.name = 'HashError';
    this.operation = context.operation;
    this.path = context.path;
    this.cause = context.cause;
  }
}

export class BackupError extends SyncError {
  public readonly operation: string;
  public readonly path: string;

  constructor(message: string, context: ErrorContext) {
    super(message, ErrorSeverity.FATAL, {
      operation: context.operation,
      path: context.path,
    });
    this.name = 'BackupError';
    this.operation = context.operation;
    this.path = context.path;
    this.cause = context.cause;
  }
}

export class ParseError extends SyncError {
  public readonly operation: string;
  public readonly path: string;

  constructor(message: string, context: ErrorContext) {
    super(message, ErrorSeverity.WARNING, {
      operation: context.operation,
      path: context.path,
    });
    this.name = 'ParseError';
    this.operation = context.operation;
    this.path = context.path;
    this.cause = context.cause;
  }
}

export class ManifestError extends SyncError {
  public readonly operation: string;
  public readonly path: string;

  constructor(message: string, context: ErrorContext) {
    super(message, ErrorSeverity.RECOVERABLE, {
      operation: context.operation,
      path: context.path,
    });
    this.name = 'ManifestError';
    this.operation = context.operation;
    this.path = context.path;
    this.cause = context.cause;
  }
}

export class RollbackError extends SyncError {
  public readonly operation: string;
  public readonly path: string;

  constructor(message: string, context: ErrorContext) {
    super(message, ErrorSeverity.FATAL, {
      operation: context.operation,
      path: context.path,
    });
    this.name = 'RollbackError';
    this.operation = context.operation;
    this.path = context.path;
    this.cause = context.cause;
  }
}


