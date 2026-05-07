import { ZodError } from "zod";
import { DomainError } from "./errors";
import { logger } from "./logger";

type Handler<Ctx> = (req: Request, ctx: Ctx) => Promise<Response> | Response;

export function withErrorHandling<Ctx = unknown>(handler: Handler<Ctx>): Handler<Ctx> {
  return async (req, ctx) => {
    try {
      return await handler(req, ctx);
    } catch (err) {
      if (err instanceof ZodError) {
        logger.info({ err: err.issues }, "validation failed");
        return Response.json(
          { error: { code: "validation", message: "Invalid input", details: err.issues } },
          { status: 400 },
        );
      }
      if (err instanceof DomainError) {
        logger.info(
          { code: err.code, status: err.status, message: err.message },
          "domain error",
        );
        return Response.json(
          {
            error: {
              code: err.code,
              message: err.message,
              ...(err.details !== undefined ? { details: err.details } : {}),
            },
          },
          { status: err.status },
        );
      }
      logger.error({ err }, "unhandled error");
      return Response.json(
        { error: { code: "internal", message: "Internal server error" } },
        { status: 500 },
      );
    }
  };
}
