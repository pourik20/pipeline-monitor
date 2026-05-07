export type ErrorCode =
  | "validation"
  | "not_found"
  | "conflict"
  | "business_rule"
  | "forbidden";

export class DomainError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly details?: unknown;

  constructor(code: ErrorCode, status: number, message: string, details?: unknown) {
    super(message);
    this.code = code;
    this.status = status;
    this.details = details;
    this.name = new.target.name;
  }
}

export class ValidationError extends DomainError {
  constructor(message: string, details?: unknown) {
    super("validation", 400, message, details);
  }
}

export class NotFoundError extends DomainError {
  constructor(message = "Resource not found") {
    super("not_found", 404, message);
  }
}

export class ConflictError extends DomainError {
  constructor(message: string, details?: unknown) {
    super("conflict", 409, message, details);
  }
}

export class BusinessRuleError extends DomainError {
  constructor(message: string, details?: unknown) {
    super("business_rule", 422, message, details);
  }
}

export class ForbiddenError extends DomainError {
  constructor(message = "Forbidden") {
    super("forbidden", 403, message);
  }
}
