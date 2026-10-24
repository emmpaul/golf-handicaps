// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import { ScrollFrame } from "@/components/scroll-frame";

vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
afterEach(() => vi.restoreAllMocks());

it("tracks both overflow edges on scroll and resize", async () => {
  let resize = () => {
    /* assigned by ResizeObserver */
  };
  const disconnect = vi.fn();
  vi.stubGlobal(
    "ResizeObserver",
    class {
      constructor(callback: () => void) {
        resize = callback;
      }
      observe() {
        /* dimensions are simulated */
      }
      disconnect = disconnect;
    },
  );
  let width = 300;
  vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockImplementation(() => width);
  vi.spyOn(HTMLElement.prototype, "scrollWidth", "get").mockReturnValue(900);
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(async () =>
    root.render(
      <ScrollFrame label="Scores">
        <table>
          <tbody>
            <tr>
              <td>18</td>
            </tr>
          </tbody>
        </table>
      </ScrollFrame>,
    ),
  );
  const frame = container.querySelector('[data-slot="scroll-frame"]');
  const scroller = container.querySelector('[data-slot="scroll-viewport"]');
  if (!frame || !scroller) throw new Error("Frame missing");
  const edges = () => [
    frame.hasAttribute("data-overflow-start"),
    frame.hasAttribute("data-overflow-end"),
  ];
  // Mutation: scrollLeft >= 0 wrongly shows a start fade at the beginning.
  expect(edges()).toEqual([false, true]);
  for (const [left, expected] of [
    [200, [true, true]],
    [600, [true, false]],
    [0, [false, true]],
  ] as const) {
    await act(async () => {
      scroller.scrollLeft = left;
      scroller.dispatchEvent(new Event("scroll"));
    });
    expect(edges()).toEqual(expected);
  }
  await act(async () => {
    width = 900;
    resize();
  });
  expect(edges()).toEqual([false, false]);
  await act(async () => root.unmount());
  expect(disconnect).toHaveBeenCalled();
  container.remove();
});
