/**
 * NeetCode roadmap: which topic you should finish before another one.
 * `parents` = prerequisites. x/y = node centre in the tree's SVG coordinates (1000 × 860).
 */
export type TreeNode = { topic: string; short?: string; x: number; y: number; parents: string[] };

export const TREE_W = 1000;
export const TREE_H = 860;
export const NODE_W = 176;
export const NODE_H = 66;

export const NEETCODE_TREE: TreeNode[] = [
  { topic: "Arrays & Hashing", x: 500, y: 45, parents: [] },
  { topic: "Two Pointers", x: 360, y: 155, parents: ["Arrays & Hashing"] },
  { topic: "Stack", x: 640, y: 155, parents: ["Arrays & Hashing"] },
  { topic: "Binary Search", x: 170, y: 265, parents: ["Two Pointers"] },
  { topic: "Sliding Window", x: 400, y: 265, parents: ["Two Pointers"] },
  { topic: "Linked List", x: 630, y: 265, parents: ["Two Pointers"] },
  { topic: "Trees", x: 400, y: 375, parents: ["Binary Search", "Linked List"] },
  { topic: "Tries", x: 160, y: 485, parents: ["Trees"] },
  { topic: "Heap / Priority Queue", short: "Heap / PQ", x: 400, y: 485, parents: ["Trees"] },
  { topic: "Backtracking", x: 680, y: 485, parents: ["Trees"] },
  { topic: "Intervals", x: 100, y: 600, parents: ["Heap / Priority Queue"] },
  { topic: "Greedy", x: 290, y: 600, parents: ["Heap / Priority Queue"] },
  { topic: "Graphs", x: 600, y: 600, parents: ["Backtracking"] },
  { topic: "1-D Dynamic Programming", short: "1-D DP", x: 860, y: 600, parents: ["Backtracking"] },
  { topic: "Advanced Graphs", x: 440, y: 715, parents: ["Heap / Priority Queue", "Graphs"] },
  { topic: "2-D Dynamic Programming", short: "2-D DP", x: 700, y: 715, parents: ["Graphs", "1-D Dynamic Programming"] },
  { topic: "Bit Manipulation", x: 900, y: 715, parents: ["1-D Dynamic Programming"] },
  { topic: "Math & Geometry", x: 790, y: 815, parents: ["Graphs", "Bit Manipulation"] },
];
