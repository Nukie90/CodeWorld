import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import FunctionTableView from "../components/features/visualizations/FunctionTableView";

const file = {
  filename: "src/example.js",
  language: "javascript",
  total_loc: 50,
  total_lloc: 30,
  function_count: 3,
  total_cognitive_complexity: 20,
  maintainability_index: 72.3,
  functions: [
    {
      name: "alpha",
      long_name: "alpha",
      start_line: 10,
      lloc: 10,
      cognitive_complexity: 5,
      cyclomatic_complexity: 3,
      total_cognitive_complexity: 5,
      maintainability_index: 80,
      max_nesting_depth: 1,
      halstead_volume: 120,
      children: [],
    },
    {
      name: "beta",
      long_name: "beta",
      start_line: 20,
      lloc: 15,
      cognitive_complexity: 10,
      cyclomatic_complexity: 8,
      total_cognitive_complexity: 10,
      maintainability_index: 60,
      max_nesting_depth: 2,
      halstead_volume: 180,
      children: [],
    },
    {
      name: "gamma",
      long_name: "gamma",
      start_line: 5,
      lloc: 5,
      cognitive_complexity: 2,
      cyclomatic_complexity: 1,
      total_cognitive_complexity: 2,
      maintainability_index: 95,
      max_nesting_depth: 1,
      halstead_volume: 80,
      children: [],
    },
  ],
};

function getVisibleOrder() {
  return screen.getAllByText(/alpha|beta|gamma/).map((node) => node.textContent);
}

describe("Function table", () => {
  test("sorting by cyclomatic complexity reorders rows", async () => {
    render(
      <FunctionTableView
        file={file}
        isDarkMode={false}
        onBack={jest.fn()}
        onFunctionClick={jest.fn()}
        onFileClick={jest.fn()}
      />
    );

    await userEvent.click(screen.getByText(/cycl\./i));
    await userEvent.click(screen.getByText(/cycl\./i));

    expect(getVisibleOrder()).toEqual(["beta", "alpha", "gamma"]);
  });

  test("sorting by maintainability index reorders rows", async () => {
    render(
      <FunctionTableView
        file={file}
        isDarkMode={false}
        onBack={jest.fn()}
        onFunctionClick={jest.fn()}
        onFileClick={jest.fn()}
      />
    );

    await userEvent.click(screen.getByText(/^mi$/i));

    expect(getVisibleOrder()).toEqual(["beta", "alpha", "gamma"]);
  });
});
