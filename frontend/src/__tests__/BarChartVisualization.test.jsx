import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";

import BarChartVisualization from "../components/features/visualizations/BarChartVisualization";

function makeFiles(overrides = []) {
  return [
    {
      filename: "src/App.jsx",
      functions: [
        {
          name: "renderApp",
          start_line: 1,
          lloc: 4,
          total_cognitive_complexity: 9,
        },
      ],
    },
    ...overrides,
  ];
}

describe("BarChartVisualization", () => {
  test("shows an empty state when there are no files to visualize", () => {
    render(
      <BarChartVisualization
        individualFiles={[]}
        onFunctionClick={jest.fn()}
        onFileClick={jest.fn()}
        fixedFileOrder={null}
        isDarkMode={false}
      />
    );

    expect(screen.getByText(/no files to visualize/i)).toBeInTheDocument();
  });

  test("clicking a function bar triggers both file and function callbacks", () => {
    const onFunctionClick = jest.fn();
    const onFileClick = jest.fn();
    const { container } = render(
      <BarChartVisualization
        individualFiles={makeFiles()}
        onFunctionClick={onFunctionClick}
        onFileClick={onFileClick}
        fixedFileOrder={null}
        isDarkMode={false}
      />
    );

    const firstBar = container.querySelector('div[style*="background-color"]');
    fireEvent.click(firstBar);

    expect(onFileClick).toHaveBeenCalledWith(
      expect.objectContaining({ filename: "src/App.jsx" })
    );
    expect(onFunctionClick).toHaveBeenCalledWith({
      filename: "src/App.jsx",
      functionName: "renderApp",
      startLine: 1,
      lloc: 4,
      complexity: 9,
    });
  });

  test("shows tooltip metadata on hover", () => {
    const { container } = render(
      <BarChartVisualization
        individualFiles={makeFiles()}
        onFunctionClick={jest.fn()}
        onFileClick={jest.fn()}
        fixedFileOrder={null}
        isDarkMode={false}
      />
    );

    const firstBar = container.querySelector('div[style*="background-color"]');
    fireEvent.mouseEnter(firstBar, { clientX: 50, clientY: 60 });

    expect(screen.getByText("renderApp")).toBeInTheDocument();
    expect(screen.getByText(/CC:/)).toBeInTheDocument();
    expect(screen.getByText(/lloc:/)).toBeInTheDocument();
  });

  test("applies the expected light-mode color bands at complexity thresholds", () => {
    const thresholdFiles = [
      {
        filename: "src/thresholds.js",
        functions: [
          { name: "low", start_line: 1, lloc: 1, total_cognitive_complexity: 9 },
          { name: "good", start_line: 2, lloc: 1, total_cognitive_complexity: 10 },
          { name: "warn", start_line: 3, lloc: 1, total_cognitive_complexity: 15 },
          { name: "critical", start_line: 4, lloc: 1, total_cognitive_complexity: 20 },
        ],
      },
    ];

    const { container } = render(
      <BarChartVisualization
        individualFiles={thresholdFiles}
        onFunctionClick={jest.fn()}
        onFileClick={jest.fn()}
        fixedFileOrder={null}
        isDarkMode={false}
      />
    );

    const bars = Array.from(container.querySelectorAll('div[style*="background-color"]'));
    const colors = bars.map((node) => node.style.backgroundColor);

    expect(colors).toEqual([
      "rgb(34, 197, 94)",
      "rgb(250, 204, 21)",
      "rgb(249, 115, 22)",
      "rgb(239, 68, 68)",
    ]);
  });
});
