/** Client sent something invalid. */
export class BadRequestError extends Error {}

/** Objex has no usable bucket/credentials yet, or they are unusable. */
export class ConfigError extends Error {}

/** Admin token missing or wrong (only when OBJEX_ADMIN_TOKEN is set). */
export class UnauthorizedError extends Error {}

/** Single place that turns thrown errors into a JSON body + status code. */
export function errorResponse(error) {
  if (error instanceof BadRequestError) {
    return { body: { error: error.message }, status: 400 };
  }
  if (error instanceof UnauthorizedError) {
    return { body: { error: error.message }, status: 401 };
  }
  if (error instanceof ConfigError) {
    // 409: the request was fine, the app just is not connected to a bucket yet.
    return { body: { error: error.message, needsSetup: true }, status: 409 };
  }
  const code = Number(error?.code);
  const status = code >= 400 && code < 600 ? code : 500;
  return {
    body: { error: error?.message || 'Unexpected error talking to Cloud Storage.' },
    status,
  };
}
