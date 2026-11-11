// Enumerate main-workspace tabs without including sidebar panels.
function documents(workspace) {
  const result = [];
  workspace.iterateRootLeaves(leaf => {
    // A truthy return stops Obsidian's traversal; do not return push's length.
    result.push(leaf);
  });
  return result;
}

module.exports = { documents };
