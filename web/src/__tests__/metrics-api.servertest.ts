import {
  makeZodVerifiedAPICall,
  pruneDatabase,
} from "@/src/__tests__/test-utils";
import { PostGenerationsV1Response } from "@/src/features/public-api/types/generations";
import { GetMetricsDailyV1Response } from "@/src/features/public-api/types/metrics";
import { PostTracesV1Response } from "@/src/features/public-api/types/traces";
import { v4 as uuidv4 } from "uuid";

describe("/api/public/metrics/daily API Endpoint", () => {
  beforeEach(async () => await pruneDatabase());
  afterEach(async () => await pruneDatabase());

  it("should handle daily metrics correctly", async () => {
    // Create traces with observations on different days
    const traceId1 = uuidv4();
    const traceId2 = uuidv4();
    await makeZodVerifiedAPICall(
      PostTracesV1Response,
      "POST",
      "/api/public/traces",
      {
        id: traceId1,
        timestamp: "2021-01-01T00:00:00.000Z",
        name: "trace-day-1",
        userId: "user-daily-metrics",
        projectId: "project-daily-metrics",
      },
    );
    await makeZodVerifiedAPICall(
      PostTracesV1Response,
      "POST",
      "/api/public/traces",
      {
        id: traceId2,
        timestamp: "2021-01-02T00:00:00.000Z",
        name: "trace-day-2",
        userId: "user-daily-metrics",
        projectId: "project-daily-metrics",
      },
    );

    // Simulate observations with usage metrics on different days
    await makeZodVerifiedAPICall(
      PostGenerationsV1Response,
      "POST",
      "/api/public/generations",
      {
        traceId: traceId1,
        model: "modelA",
        usage: { input: 100, output: 200, total: 300 },
        startTime: "2021-01-01T00:00:00.000Z",
        endTime: "2021-01-01T00:01:00.000Z",
      },
    );
    await makeZodVerifiedAPICall(
      PostGenerationsV1Response,
      "POST",
      "/api/public/generations",
      {
        traceId: traceId2,
        model: "modelB",
        usage: { input: 333 },
        startTime: "2021-01-02T00:00:00.000Z",
        endTime: "2021-01-02T00:02:00.000Z",
      },
    );
    await makeZodVerifiedAPICall(
      PostGenerationsV1Response,
      "POST",
      "/api/public/generations",
      {
        traceId: traceId2,
        model: "modelC",
        usage: { input: 666, output: 777, totalCost: 1024.22 },
        startTime: "2021-01-02T00:00:00.000Z",
        endTime: "2021-01-02T00:04:00.000Z",
      },
    );
    await makeZodVerifiedAPICall(
      PostGenerationsV1Response,
      "POST",
      "/api/public/generations",
      {
        traceId: traceId2,
        usage: { output: 300 },
        startTime: "2021-01-02T00:00:00.000Z",
        endTime: "2021-01-02T00:04:00.000Z",
      },
    );

    // Retrieve the daily metrics
    const dailyMetricsResponse = await makeZodVerifiedAPICall(
      GetMetricsDailyV1Response,
      "GET",
      `/api/public/metrics/daily`,
    );
    const dailyMetricsData = dailyMetricsResponse.body.data;

    // Check if the daily metrics are calculated correctly
    expect(dailyMetricsData).toHaveLength(2); // Two days of data
    if (!dailyMetricsData[0])
      throw new Error("dailyMetricsData[0] is undefined");
    expect(dailyMetricsData[0].date).toBe("2021-01-02"); // Latest date first
    expect(dailyMetricsData[0].countTraces).toBe(1);
    expect(dailyMetricsData[0].totalCost).toEqual(1024.22);
    expect(dailyMetricsData[0].usage).toEqual([
      {
        model: "modelB",
        inputUsage: 333,
        outputUsage: 0,
        totalUsage: 333,
        countObservations: 1,
        countTraces: 1,
        totalCost: 0,
      },
      {
        model: "modelC",
        inputUsage: 666,
        outputUsage: 777,
        totalUsage: 1443,
        countObservations: 1,
        countTraces: 1,
        totalCost: 1024.22,
      },
      {
        model: null,
        countObservations: 1,
        countTraces: 1,
        inputUsage: 0,
        outputUsage: 300,
        totalCost: 0,
        totalUsage: 300,
      },
    ]);

    if (!dailyMetricsData[1])
      throw new Error("dailyMetricsData[1] is undefined");
    expect(dailyMetricsData[1].date).toBe("2021-01-01");
    expect(dailyMetricsData[1].countTraces).toBe(1);
    expect(dailyMetricsData[1].totalCost).toEqual(0);
    expect(dailyMetricsData[1].usage).toEqual([
      {
        model: "modelA",
        inputUsage: 100,
        outputUsage: 200,
        totalUsage: 300,
        countObservations: 1,
        countTraces: 1,
        totalCost: 0,
      },
    ]);
  });

  it("should handle daily metrics correctly when there is no data", async () => {
    // Retrieve the daily metrics
    const dailyMetricsResponse = await makeZodVerifiedAPICall(
      GetMetricsDailyV1Response,
      "GET",
      `/api/public/metrics/daily`,
    );
    const dailyMetricsData = dailyMetricsResponse.body.data;

    // Check if the daily metrics are calculated correctly
    expect(dailyMetricsData).toHaveLength(0); // No data
  });

  it("should handle daily metrics correctly when there is just a trace", async () => {
    const traceId1 = uuidv4();
    await makeZodVerifiedAPICall(
      PostTracesV1Response,
      "POST",
      "/api/public/traces",
      {
        id: traceId1,
        timestamp: "2021-01-01T00:00:00.000Z",
        name: "trace-day-1",
        userId: "user-daily-metrics",
        projectId: "project-daily-metrics",
      },
    );

    // Retrieve the daily metrics
    const dailyMetricsResponse = await makeZodVerifiedAPICall(
      GetMetricsDailyV1Response,
      "GET",
      `/api/public/metrics/daily`,
    );
    const dailyMetricsData = dailyMetricsResponse.body.data;

    // Check if the daily metrics are calculated correctly
    expect(dailyMetricsData).toHaveLength(1);
    expect(dailyMetricsData[0].date).toBe("2021-01-01");
    expect(dailyMetricsData[0].countTraces).toBe(1);
    expect(dailyMetricsData[0].totalCost).toEqual(0);
    expect(dailyMetricsData[0].usage).toEqual([]);
  });
});
