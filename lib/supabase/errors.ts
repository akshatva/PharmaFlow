type SupabaseLikeError = {
  code?: string | null;
  message?: string | null;
};

export function isMissingRelationError(
  error: SupabaseLikeError | null | undefined,
  relationName?: string,
) {
  if (!error) {
    return false;
  }

  if (error.code === "PGRST205") {
    return relationName
      ? error.message?.includes(`public.${relationName}`) ?? false
      : true;
  }

  if (!error.message) {
    return false;
  }

  if (relationName) {
    return error.message.includes(`public.${relationName}`);
  }

  return error.message.includes("schema cache");
}
