import { assertEquals } from "https://deno.land/std@0.203.0/testing/asserts.ts";
import { buildParsedContentFromFiles } from "../index.ts";

Deno.test("buildParsedContentFromFiles concatenates in order and respects budget", () => {
  const files = [
    { id: "f1", parsed_content: "AAA" },
    { id: "f2", parsed_content: "BBBB" },
    { id: "f3", parsed_content: "CCCCCC" },
  ];

  const res = buildParsedContentFromFiles(files, 100);
  assertEquals(res.context.includes("AAA"), true);
  assertEquals(res.context.includes("BBBB"), true);
  assertEquals(res.context.includes("CCCCCC"), true);
  assertEquals(res.filesUsed.length, 3);
  assertEquals(res.truncated, false);
});

Deno.test("buildParsedContentFromFiles truncates when budget small", () => {
  const files = [
    { id: "f1", parsed_content: "A".repeat(50) },
    { id: "f2", parsed_content: "B".repeat(50) },
  ];

  const res = buildParsedContentFromFiles(files, 60);
  // Should include some of f1 and possibly truncated f2
  assertEquals(res.filesUsed.length >= 1, true);
  assertEquals(res.truncated, true);
  assertEquals(res.context.length <= 60, true);
});