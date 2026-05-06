import { useEffect, useMemo, useState } from "react";
import { api, type SourceQueueJob, type SourceQueueStatus } from "../api";

function formatTime(value: string | null) {
    if (!value) return "—";

    return new Date(value).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
    });
}

function JobProgress({ job }: { job: SourceQueueJob }) {
    const percent =
        job.progressTotal > 0
            ? Math.round((job.progressCurrent / job.progressTotal) * 100)
            : null;

    return (
        <div className="queueJobProgress">
            <div className="queueJobProgressHeader">
                <span>{percent !== null ? `${percent}%` : "Working..."}</span>

                {job.progressTotal > 0 && (
                    <span>
                        {job.progressCurrent}/{job.progressTotal}
                    </span>
                )}
            </div>

            <div className="progressBar">
                <div style={{ width: `${percent ?? 12}%` }} />
            </div>
        </div>
    );
}

export function QueueStatus() {
    const [status, setStatus] = useState<SourceQueueStatus | null>(null);
    const [expanded, setExpanded] = useState(false);

    async function load() {
        setStatus(await api.getSourceQueues());
    }

    useEffect(() => {
        void load();

        const id = window.setInterval(() => {
            void load();
        }, 1500);

        return () => window.clearInterval(id);
    }, []);

    const runningJobs = useMemo(() => {
        return status?.queues
            .map((queue) => queue.activeJob)
            .filter((job): job is SourceQueueJob => Boolean(job)) ?? [];
    }, [status]);

    const failedJobs = useMemo(() => {
        return status?.recentJobs.filter((job) => job.status === "failed").slice(0, 3) ?? [];
    }, [status]);

    const queuedJobs = useMemo(() => {
        return status?.queues.flatMap((queue) => queue.queuedJobs) ?? [];
    }, [status]);

    const latestRunning = runningJobs[0];
    const queuedCount = queuedJobs.length;

    if (!latestRunning && queuedCount === 0 && failedJobs.length === 0) {
        return null;
    }

    return (
        <div className="queueStatus">
            <div className="queueStatusHeader">
                <div>
                    <strong>
                        {latestRunning ? "Job Running" : queuedCount > 0 ? "Jobs Queued" : "Recent Failure"}
                    </strong>

                    <p className="muted">
                        {runningJobs.length} running · {queuedCount} queued ·{" "}
                        {failedJobs.length} failed
                    </p>
                </div>

                <button className="queueToggle" onClick={() => setExpanded((value) => !value)}>
                    {expanded ? "Hide" : "Details"}
                </button>
            </div>

            {latestRunning && (
                <div className="queueCurrentJob">
                    <p className="queueJobName">{latestRunning.name}</p>
                    <p className="muted">{latestRunning.message}</p>
                    <JobProgress job={latestRunning} />

                    <p className="muted queueMeta">
                        Source: {latestRunning.sourceId} · Started:{" "}
                        {formatTime(latestRunning.startedAt)}
                    </p>
                </div>
            )}

            {!latestRunning && queuedJobs[0] && (
                <div className="queueCurrentJob">
                    <p className="queueJobName">Next: {queuedJobs[0].name}</p>
                    <p className="muted">Waiting in {queuedJobs[0].sourceId} queue</p>
                </div>
            )}

            {expanded && (
                <div className="queueDetails">
                    {queuedJobs.length > 0 && (
                        <section>
                            <h3>Queued</h3>

                            <div className="queueMiniList">
                                {queuedJobs.slice(0, 8).map((job, index) => (
                                    <div className="queueMiniJob" key={job.id}>
                                        <span>#{index + 1}</span>
                                        <div>
                                            <p>{job.name}</p>
                                            <p className="muted">
                                                {job.sourceId} · queued {formatTime(job.createdAt)}
                                            </p>
                                        </div>
                                    </div>
                                ))}

                                {queuedJobs.length > 8 && (
                                    <p className="muted">+{queuedJobs.length - 8} more queued</p>
                                )}
                            </div>
                        </section>
                    )}

                    {runningJobs.length > 1 && (
                        <section>
                            <h3>Other Running Jobs</h3>

                            <div className="queueMiniList">
                                {runningJobs.slice(1).map((job) => (
                                    <div className="queueMiniJob" key={job.id}>
                                        <span>{job.sourceId}</span>
                                        <div>
                                            <p>{job.name}</p>
                                            <p className="muted">{job.message}</p>
                                            <JobProgress job={job} />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </section>
                    )}

                    {failedJobs.length > 0 && (
                        <section>
                            <h3>Recent Failures</h3>

                            <div className="queueMiniList">
                                {failedJobs.map((job) => (
                                    <div className="queueMiniJob failed" key={job.id}>
                                        <span>!</span>
                                        <div>
                                            <p>{job.name}</p>
                                            <p className="muted">{job.error ?? "Unknown error"}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </section>
                    )}
                </div>
            )}
        </div>
    );
}