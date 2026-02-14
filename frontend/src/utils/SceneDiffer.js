/**
 * SceneDiffer - Utility for comparing file lists to enable incremental scene updates
 * 
 * Instead of rebuilding the entire 3D scene on every commit change, this utility
 * identifies exactly what changed so we can update only the affected buildings.
 */

export class SceneDiffer {
    /**
     * Compare two file lists and identify changes
     * @param {Array} oldFiles - Previous commit's file list
     * @param {Array} newFiles - Current commit's file list
     * @returns {Object} - { added, removed, modified, unchanged }
     */
    static diffFiles(oldFiles, newFiles) {
        const added = [];
        const removed = [];
        const modified = [];
        const unchanged = [];

        // Create maps for O(1) lookup
        const oldMap = new Map(oldFiles.map(f => [f.filename, f]));
        const newMap = new Map(newFiles.map(f => [f.filename, f]));

        // Find added and modified files
        for (const [filename, newFile] of newMap) {
            const oldFile = oldMap.get(filename);
            if (!oldFile) {
                added.push(newFile);
            } else if (this.hasChanged(oldFile, newFile)) {
                modified.push({ old: oldFile, new: newFile, filename });
            } else {
                unchanged.push(newFile);
            }
        }

        // Find removed files
        for (const [filename, oldFile] of oldMap) {
            if (!newMap.has(filename)) {
                removed.push(oldFile);
            }
        }

        return { added, removed, modified, unchanged };
    }

    /**
     * Check if a file has changed between commits
     * @param {Object} oldFile - Previous version of the file
     * @param {Object} newFile - Current version of the file
     * @returns {boolean} - True if file has meaningful changes
     */
    static hasChanged(oldFile, newFile) {
        // Check if LOC changed
        if ((oldFile.nloc || oldFile.loc) !== (newFile.nloc || newFile.loc)) {
            return true;
        }

        // Check if complexity changed
        if (oldFile.total_complexity !== newFile.total_complexity) {
            return true;
        }

        // Check if function count changed
        const oldFnCount = oldFile.functions?.length || 0;
        const newFnCount = newFile.functions?.length || 0;
        if (oldFnCount !== newFnCount) {
            return true;
        }

        // Check if unsupported status changed
        if (oldFile.is_unsupported !== newFile.is_unsupported) {
            return true;
        }

        return false;
    }

    /**
     * Get a summary of changes for logging/debugging
     * @param {Object} diff - Result from diffFiles()
     * @returns {string} - Human-readable summary
     */
    static getSummary(diff) {
        return `+${diff.added.length} files, -${diff.removed.length} files, ~${diff.modified.length} files, =${diff.unchanged.length} files`;
    }
}
