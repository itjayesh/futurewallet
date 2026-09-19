export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

/** Thrown when a request needs a profile that onboarding has not created yet. */
export const notOnboarded = () => new HttpError(409, "Complete onboarding first.");
