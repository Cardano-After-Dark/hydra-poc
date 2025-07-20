/**
 * Simple test script for debugging
 */

// This function is used to verify the debugger is working
function testDebugger(value: string): string {
  console.log("Starting debug test");
  
  // You can set a breakpoint on the next line
  const processed = value.toUpperCase();
  
  // Another good place for a breakpoint
  const result = `Processed: ${processed}`;
  
  console.log(result);
  return result;
}

// Main function
export async function main() {
  console.log("Debug test script started");
  
  const input = "hello world";
  const output = testDebugger(input);
  
  console.log("Debug test completed with result:", output);
}

// Run if this is the main module using ES module approach
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error("Error in debug test:", error);
  });
} 