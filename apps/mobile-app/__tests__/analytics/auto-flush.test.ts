describe("analytics auto flush", () => {
    let currentState = "active";
    let changeHandler: ((state: string) => void) | null = null;
    const remove = jest.fn();

    beforeEach(() => {
        jest.useFakeTimers();
        jest.resetModules();
        currentState = "active";
        changeHandler = null;
        remove.mockClear();
        jest.doMock("react-native", () => ({
            AppState: {
                get currentState() {
                    return currentState;
                },
                addEventListener: jest.fn((_event, handler) => {
                    changeHandler = handler;
                    return { remove };
                }),
            },
        }));
    });

    afterEach(() => {
        jest.useRealTimers();
        jest.dontMock("react-native");
    });

    it("starts while active, stops while backgrounded, and resumes on active", async () => {
        const setIntervalSpy = jest.spyOn(global, "setInterval");
        const clearIntervalSpy = jest.spyOn(global, "clearInterval");
        const analytics = require("../../lib/analytics");

        const cleanup = analytics.startAnalyticsAutoFlush({ force: true });
        expect(setIntervalSpy).toHaveBeenCalledTimes(1);

        changeHandler?.("background");
        expect(clearIntervalSpy).toHaveBeenCalledTimes(1);

        changeHandler?.("active");
        expect(setIntervalSpy).toHaveBeenCalledTimes(2);

        cleanup();
        expect(remove).toHaveBeenCalled();
    });
});
