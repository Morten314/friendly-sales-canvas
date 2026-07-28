import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { FeatureErrorBoundary } from "@/shared/components/FeatureErrorBoundary";

// A child that throws during render, to trip the boundary.
function Boom(): never {
  throw new Error("boom");
}

afterEach(() => vi.restoreAllMocks());

describe("FeatureErrorBoundary", () => {
  it("renders children normally when they do not throw", () => {
    render(
      <FeatureErrorBoundary>
        <div>child-content</div>
      </FeatureErrorBoundary>,
    );
    expect(screen.getByText("child-content")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("renders the fallback when a child throws, without blanking the app", () => {
    // React logs the caught error to console.error; suppress the noise.
    vi.spyOn(console, "error").mockImplementation(() => {});
    render(
      <FeatureErrorBoundary featureName="Test Feature">
        <Boom />
      </FeatureErrorBoundary>,
    );
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.queryByText("child-content")).not.toBeInTheDocument();
  });

  it("does not catch errors thrown outside its own subtree", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    // `Boom` is a sibling, NOT a descendant of the boundary. With no ancestor
    // boundary, the render throws — proving the error escaped this boundary
    // rather than being swallowed by it.
    expect(() =>
      render(
        <>
          <FeatureErrorBoundary>
            <div>safe-sibling</div>
          </FeatureErrorBoundary>
          <Boom />
        </>,
      ),
    ).toThrow("boom");
  });

  it("logs via console.error and invokes the onError hook when a child throws", () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const onError = vi.fn();
    render(
      <FeatureErrorBoundary onError={onError}>
        <Boom />
      </FeatureErrorBoundary>,
    );
    expect(consoleSpy).toHaveBeenCalled();
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0][0]).toBeInstanceOf(Error);
  });
});
