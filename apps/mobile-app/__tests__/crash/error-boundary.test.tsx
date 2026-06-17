import React from "react";
import { ErrorBoundary } from "../../components/ErrorBoundary";
import { captureException } from "../../lib/sentry";

jest.mock("../../components/CrashScreen", () => ({
    CrashScreen: () => null,
}));

jest.mock("../../lib/sentry", () => ({
    captureException: jest.fn(),
}));

describe("ErrorBoundary", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it("reports caught render errors to Sentry with the component stack", () => {
        const boundary = new ErrorBoundary({ children: React.createElement(React.Fragment) });
        const error = new Error("render exploded");
        const errorInfo = { componentStack: "\n    in CheckoutScreen" };

        boundary.componentDidCatch(error, errorInfo);

        expect(captureException).toHaveBeenCalledWith(error, {
            componentStack: "\n    in CheckoutScreen",
        });
    });
});
