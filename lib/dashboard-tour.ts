/**
 * Guided tour for the BreakPoint dashboard.
 * Uses driver.js; steps target elements by id (tour-*).
 * Call startDashboardTour() from a client component (e.g. button click).
 */

const dashboardTourSteps = [
  {
    element: "#tour-config-cards",
    popover: {
      title: "Config A & B",
      description:
        "Compare two model configurations here. Flip the cards to adjust context window, temperature, tools, and other settings for each config.",
      side: "right" as const,
      align: "start" as const,
    },
  },
  {
    element: "#tour-run-mode",
    popover: {
      title: "Run mode",
      description:
        "Choose Simulate (fast, no API keys) or Real API. Pick Quick (20 prompts) or Full (200 prompts) for the run size.",
      side: "right" as const,
      align: "start" as const,
    },
  },
  {
    element: "#tour-run-simulation",
    popover: {
      title: "Run Simulation",
      description:
        "Click to run probes for both configs. The traffic light shows status; results appear in the right column.",
      side: "right" as const,
      align: "start" as const,
    },
  },
  {
    element: "#tour-traffic-light",
    popover: {
      title: "Traffic light",
      description:
        "Shows run status: idle, running, success, or failure. Green when the simulation completes successfully.",
      side: "left" as const,
      align: "center" as const,
    },
  },
  {
    element: "#tour-results",
    popover: {
      title: "Results",
      description:
        "After a run you'll see the recommendation, confidence, failure rates, distributions, and the failure hotspot matrix here.",
      side: "left" as const,
      align: "start" as const,
    },
  },
];

/**
 * Start the dashboard guided tour. Loads driver.js and its CSS dynamically.
 */
export async function startDashboardTour(): Promise<void> {
  const [{ driver }] = await Promise.all([
    import("driver.js"),
    import("driver.js/dist/driver.css"),
  ]);

  const driverObj = driver({
    showProgress: true,
    steps: dashboardTourSteps,
    nextBtnText: "Next",
    prevBtnText: "Previous",
    doneBtnText: "Done",
    progressText: "{{current}} of {{total}}",
  });

  driverObj.drive();
}
