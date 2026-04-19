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

export function isMissingColumnError(
  error: SupabaseLikeError | null | undefined,
  columnName: string,
) {
  if (!error?.message) {
    return false;
  }

  const message = error.message.toLowerCase();
  return (
    message.includes("could not find the") &&
    message.includes(columnName.toLowerCase())
  ) || (
    message.includes("column") &&
    message.includes(columnName.toLowerCase()) &&
    message.includes("does not exist")
  );
}
