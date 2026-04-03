export function isPublicProfileEnabled(entity) {
    if (!entity) return false;
    if (typeof entity.publicProfileEnabled === "boolean") {
        return entity.publicProfileEnabled;
    }
    if (typeof entity.presenceConfig?.publicProfileEnabled === "boolean") {
        return entity.presenceConfig.publicProfileEnabled;
    }
    return true;
}
