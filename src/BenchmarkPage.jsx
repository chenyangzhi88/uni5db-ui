import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDownOutlined,
  ArrowUpOutlined,
  BarChartOutlined,
  CheckOutlined,
  CloseOutlined,
  CodeOutlined,
  DatabaseOutlined,
  InfoCircleOutlined,
  LoadingOutlined,
  ReloadOutlined,
  ThunderboltOutlined,
  UploadOutlined,
} from '@ant-design/icons';
import './BenchmarkPage.css';

async function benchmarkApi(path, options) {
  const response = await fetch(`/api${path}`, {
    headers: { 'content-type': 'application/json' },
    ...options,
  });
  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }
  if (!response.ok || data?.ok === false) {
    throw new Error(data?.error || text || `Benchmark API failed (${response.status})`);
  }
  return data;
}

function metricValue(run, metricId) {
  return run?.metrics?.find((metric) => metric.metricId === metricId) || null;
}

function compareRuns(project, baseline, candidate, thresholds) {
  if (!project || !baseline || !candidate) return [];
  return project.metrics.map((definition) => {
    const beforeMetric = metricValue(baseline, definition.id);
    const afterMetric = metricValue(candidate, definition.id);
    const before = Number(beforeMetric?.value);
    const after = Number(afterMetric?.value);
    if (!Number.isFinite(before) || !Number.isFinite(after)) {
      return { ...definition, before: null, after: null, impact: null, rawDelta: null, status: 'missing', variancePct: null };
    }
    const rawDelta = before === 0 ? 0 : (after - before) / Math.abs(before) * 100;
    const impact = definition.direction === 'higher' ? rawDelta : -rawDelta;
    const status = impact <= -thresholds.criticalPct
      ? 'critical'
      : impact <= -thresholds.regressionPct
        ? 'regression'
        : impact >= thresholds.regressionPct
          ? 'improved'
          : 'stable';
    return {
      ...definition,
      before,
      after,
      impact,
      rawDelta,
      status,
      variancePct: afterMetric?.variancePct ?? null,
    };
  });
}

function formatNumber(value, maximumFractionDigits = 1) {
  if (!Number.isFinite(Number(value))) return '—';
  const numeric = Number(value);
  if (Math.abs(numeric) >= 10000) {
    return new Intl.NumberFormat('en', {
      notation: 'compact',
      maximumFractionDigits,
    }).format(numeric);
  }
  return new Intl.NumberFormat('en', {
    maximumFractionDigits: Math.abs(numeric) < 10 ? 2 : maximumFractionDigits,
  }).format(numeric);
}

function formatMetric(value, unit) {
  if (!Number.isFinite(Number(value))) return '—';
  return `${formatNumber(value)} ${unit}`;
}

function formatDelta(value) {
  if (!Number.isFinite(Number(value))) return '—';
  const numeric = Number(value);
  return `${numeric > 0 ? '+' : ''}${numeric.toFixed(1)}%`;
}

function statusLabel(status) {
  return {
    critical: 'Critical',
    regression: 'Regression',
    improved: 'Improved',
    stable: 'Stable',
    missing: 'Missing',
  }[status] || status;
}

function MiniSparkline({ values = [], direction = 'higher' }) {
  const clean = values.map(Number).filter(Number.isFinite);
  if (clean.length < 2) return <span className="benchmark-sparkline-empty">—</span>;
  const min = Math.min(...clean);
  const max = Math.max(...clean);
  const range = max - min || 1;
  const points = clean.map((value, index) => {
    const x = 3 + index * (74 / Math.max(1, clean.length - 1));
    const y = 25 - (value - min) / range * 20;
    return `${x},${y}`;
  }).join(' ');
  const lastChange = clean[clean.length - 1] - clean[clean.length - 2];
  const improved = direction === 'higher' ? lastChange >= 0 : lastChange <= 0;
  return (
    <svg className={improved ? 'benchmark-sparkline improved' : 'benchmark-sparkline regression'} viewBox="0 0 80 30" aria-hidden="true">
      <polyline points={points} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={points.split(' ').at(-1).split(',')[0]} cy={points.split(' ').at(-1).split(',')[1]} r="2.5" fill="currentColor" />
    </svg>
  );
}

function MetricTrendChart({ project, runs, metricId, baselineId, candidateId }) {
  const definition = project?.metrics.find((metric) => metric.id === metricId);
  const series = runs.map((run) => ({
    run,
    value: Number(metricValue(run, metricId)?.value),
  })).filter((item) => Number.isFinite(item.value));
  if (!definition || !series.length) {
    return <div className="benchmark-chart-empty">No trend data for this metric.</div>;
  }

  const width = 760;
  const height = 224;
  const left = 58;
  const right = 24;
  const top = 22;
  const bottom = 42;
  const values = series.map((item) => item.value);
  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);
  const margin = (rawMax - rawMin || Math.abs(rawMax) || 1) * 0.18;
  const min = Math.max(0, rawMin - margin);
  const max = rawMax + margin;
  const range = max - min || 1;
  const points = series.map((item, index) => ({
    ...item,
    x: left + index * ((width - left - right) / Math.max(1, series.length - 1)),
    y: top + (max - item.value) / range * (height - top - bottom),
  }));
  const line = points.map((point) => `${point.x},${point.y}`).join(' ');
  const gridValues = [0, 0.5, 1].map((ratio) => ({
    y: top + ratio * (height - top - bottom),
    value: max - ratio * range,
  }));

  return (
    <div className="benchmark-trend-chart">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${definition.name} version trend`}>
        {gridValues.map((grid) => (
          <g key={grid.y}>
            <line x1={left} x2={width - right} y1={grid.y} y2={grid.y} className="benchmark-chart-grid" />
            <text x={left - 9} y={grid.y + 4} textAnchor="end" className="benchmark-chart-axis">{formatNumber(grid.value)}</text>
          </g>
        ))}
        <polyline points={line} className="benchmark-chart-line-shadow" fill="none" />
        <polyline points={line} className="benchmark-chart-line" fill="none" />
        {points.map((point) => {
          const selected = point.run.id === baselineId || point.run.id === candidateId;
          const role = point.run.id === candidateId ? 'candidate' : point.run.id === baselineId ? 'baseline' : '';
          return (
            <g key={point.run.id} className={`benchmark-chart-point ${role}`}>
              <circle cx={point.x} cy={point.y} r={selected ? 6 : 4} />
              <text x={point.x} y={height - 18} textAnchor="middle" className="benchmark-chart-version">{point.run.version}</text>
              {selected && (
                <text x={point.x} y={point.y - 13} textAnchor="middle" className="benchmark-chart-value">
                  {formatMetric(point.value, definition.unit)}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function BenchmarkPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [projectId, setProjectId] = useState('onedis');
  const [baselineId, setBaselineId] = useState('');
  const [candidateId, setCandidateId] = useState('');
  const [trendMetricId, setTrendMetricId] = useState('');
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef(null);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setData(await benchmarkApi('/benchmarks/dashboard'));
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const project = useMemo(
    () => data?.projects?.find((item) => item.id === projectId) || data?.projects?.[0] || null,
    [data, projectId],
  );
  const projectRuns = useMemo(
    () => (data?.runs || [])
      .filter((run) => run.project === project?.id && run.status === 'completed')
      .sort((left, right) => new Date(left.recordedAt) - new Date(right.recordedAt)),
    [data, project?.id],
  );

  useEffect(() => {
    if (!project || !projectRuns.length) return;
    const baselineExists = projectRuns.some((run) => run.id === baselineId);
    const candidateExists = projectRuns.some((run) => run.id === candidateId);
    if (!baselineExists) setBaselineId(projectRuns.at(-2)?.id || projectRuns[0].id);
    if (!candidateExists) setCandidateId(projectRuns.at(-1).id);
    if (!project.metrics.some((metric) => metric.id === trendMetricId)) {
      setTrendMetricId(project.metrics[0]?.id || '');
    }
  }, [baselineId, candidateId, project, projectRuns, trendMetricId]);

  const baseline = projectRuns.find((run) => run.id === baselineId) || null;
  const candidate = projectRuns.find((run) => run.id === candidateId) || null;
  const thresholds = data?.thresholds || {
    regressionPct: 5,
    criticalPct: 10,
    maxVariancePct: 5,
    minCompletenessPct: 90,
  };
  const comparisons = useMemo(
    () => compareRuns(project, baseline, candidate, thresholds),
    [baseline, candidate, project, thresholds],
  );
  const regressions = comparisons.filter((metric) => metric.status === 'regression' || metric.status === 'critical');
  const improvements = comparisons.filter((metric) => metric.status === 'improved');
  const missingMetrics = comparisons.filter((metric) => metric.status === 'missing');
  const averageImpact = comparisons.length
    ? comparisons.filter((metric) => Number.isFinite(metric.impact)).reduce((sum, metric) => sum + metric.impact, 0)
      / Math.max(1, comparisons.filter((metric) => Number.isFinite(metric.impact)).length)
    : 0;
  const performanceScore = Math.max(0, Math.min(200, Math.round(100 + averageImpact)));
  const coveragePassed = (candidate?.completeness || 0) >= thresholds.minCompletenessPct;
  const gatePassed = Boolean(candidate) && !regressions.length && !missingMetrics.length && coveragePassed;

  const importRun = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setImporting(true);
    setError('');
    try {
      const parsed = JSON.parse(await file.text());
      const response = await benchmarkApi('/benchmarks/runs', {
        method: 'POST',
        body: JSON.stringify(parsed),
      });
      setProjectId(response.run.project);
      await loadDashboard();
      setCandidateId(response.run.id);
    } catch (importError) {
      setError(importError.message);
    } finally {
      setImporting(false);
    }
  };

  if (loading && !data) {
    return (
      <main className="benchmark-page benchmark-page-loading">
        <LoadingOutlined />
        <span>Loading benchmark history…</span>
      </main>
    );
  }

  if (error && !data) {
    return (
      <main className="benchmark-page benchmark-page-loading error">
        <CloseOutlined />
        <strong>Benchmark data is unavailable</strong>
        <span>{error}</span>
        <button type="button" onClick={loadDashboard}><ReloadOutlined /> Retry</button>
      </main>
    );
  }

  return (
    <main className="benchmark-page">
      <header className="benchmark-header">
        <div>
          <span className="benchmark-eyebrow">PERFORMANCE ENGINEERING</span>
          <h1>Benchmark Lab</h1>
          <p>Compare every version, protect hot paths, and stop performance regressions before release.</p>
        </div>
        <div className="benchmark-header-actions">
          <span className={`benchmark-source-badge ${data?.source || 'bootstrap'}`}>
            <span />
            {data?.source === 'bootstrap' ? 'Bootstrap dataset' : `${data?.source} dataset`}
          </span>
          <input ref={fileInputRef} type="file" accept="application/json,.json" onChange={importRun} hidden />
          <button type="button" className="benchmark-secondary-button" onClick={() => fileInputRef.current?.click()} disabled={importing}>
            {importing ? <LoadingOutlined /> : <UploadOutlined />} Import run
          </button>
          <button type="button" className="benchmark-icon-button" title="Refresh benchmark data" onClick={loadDashboard} disabled={loading}>
            {loading ? <LoadingOutlined /> : <ReloadOutlined />}
          </button>
        </div>
      </header>

      {error && (
        <div className="benchmark-inline-error">
          <InfoCircleOutlined />
          <span>{error}</span>
          <button type="button" onClick={() => setError('')}><CloseOutlined /></button>
        </div>
      )}

      <section className="benchmark-project-switcher">
        {(data?.projects || []).map((item) => {
          const runs = (data?.runs || [])
            .filter((run) => run.project === item.id && run.status === 'completed')
            .sort((left, right) => new Date(left.recordedAt) - new Date(right.recordedAt));
          const latestComparison = compareRuns(item, runs.at(-2), runs.at(-1), thresholds);
          const regressionCount = latestComparison.filter((metric) => metric.status === 'regression' || metric.status === 'critical').length;
          return (
            <button
              type="button"
              className={item.id === project?.id ? 'benchmark-project-card active' : 'benchmark-project-card'}
              style={{ '--project-accent': item.accent }}
              onClick={() => setProjectId(item.id)}
              key={item.id}
            >
              <span className="benchmark-project-icon"><DatabaseOutlined /></span>
              <span className="benchmark-project-copy">
                <strong>{item.name}</strong>
                <small>{item.description}</small>
              </span>
              <span className={regressionCount ? 'benchmark-project-health failing' : 'benchmark-project-health passing'}>
                {regressionCount ? `${regressionCount} regressions` : 'Passing'}
              </span>
            </button>
          );
        })}
      </section>

      <section className="benchmark-compare-bar">
        <div className="benchmark-compare-title">
          <span><BarChartOutlined /></span>
          <div>
            <strong>Version comparison</strong>
            <small>{project?.name} · same environment required</small>
          </div>
        </div>
        <label>
          <span>BASELINE</span>
          <select value={baselineId} onChange={(event) => setBaselineId(event.target.value)}>
            {projectRuns.map((run) => (
              <option value={run.id} key={run.id}>{run.version} · {run.versionLabel}</option>
            ))}
          </select>
        </label>
        <span className="benchmark-compare-arrow">→</span>
        <label>
          <span>CANDIDATE</span>
          <select value={candidateId} onChange={(event) => setCandidateId(event.target.value)}>
            {projectRuns.map((run) => (
              <option value={run.id} key={run.id}>{run.version} · {run.versionLabel}</option>
            ))}
          </select>
        </label>
        <div className="benchmark-environment">
          <span>ENVIRONMENT</span>
          <strong>{candidate?.environment?.fingerprint || 'unknown'}</strong>
        </div>
      </section>

      <section className="benchmark-kpi-grid">
        <article className="benchmark-kpi">
          <span>PERFORMANCE SCORE</span>
          <div><strong>{performanceScore}</strong><small>/ 100 baseline</small></div>
          <p className={averageImpact >= 0 ? 'positive' : 'negative'}>
            {averageImpact >= 0 ? <ArrowUpOutlined /> : <ArrowDownOutlined />}
            {formatDelta(averageImpact)} aggregate impact
          </p>
        </article>
        <article className="benchmark-kpi">
          <span>REGRESSIONS</span>
          <div><strong className={regressions.length ? 'danger' : 'success'}>{regressions.length}</strong><small>of {comparisons.length} metrics</small></div>
          <p>{regressions.filter((metric) => metric.status === 'critical').length} critical · threshold {thresholds.regressionPct}%</p>
        </article>
        <article className="benchmark-kpi">
          <span>IMPROVEMENTS</span>
          <div><strong className="success">{improvements.length}</strong><small>measurable wins</small></div>
          <p>{comparisons.filter((metric) => metric.status === 'stable').length} stable metrics</p>
        </article>
        <article className="benchmark-kpi">
          <span>SUITE COMPLETENESS</span>
          <div><strong className={coveragePassed ? 'success' : 'warning'}>{candidate?.completeness || 0}%</strong><small>{candidate?.suites?.collected || 0}/{candidate?.suites?.expected || 0} suites</small></div>
          <p>Required gate ≥ {thresholds.minCompletenessPct}%</p>
        </article>
      </section>

      <section className="benchmark-overview-grid">
        <article className="benchmark-panel benchmark-trend-panel">
          <div className="benchmark-panel-head">
            <div>
              <span>VERSION TRAJECTORY</span>
              <strong>{project?.metrics.find((metric) => metric.id === trendMetricId)?.name || 'Metric trend'}</strong>
            </div>
            <select value={trendMetricId} onChange={(event) => setTrendMetricId(event.target.value)}>
              {(project?.metrics || []).map((metric) => <option value={metric.id} key={metric.id}>{metric.shortName}</option>)}
            </select>
          </div>
          <MetricTrendChart
            project={project}
            runs={projectRuns}
            metricId={trendMetricId}
            baselineId={baselineId}
            candidateId={candidateId}
          />
          <div className="benchmark-chart-legend">
            <span><i className="baseline" /> Baseline</span>
            <span><i className="candidate" /> Candidate</span>
            <span>Direction: {project?.metrics.find((metric) => metric.id === trendMetricId)?.direction === 'higher' ? 'higher is better' : 'lower is better'}</span>
          </div>
        </article>

        <article className={`benchmark-panel benchmark-gate-panel ${gatePassed ? 'passing' : 'failing'}`}>
          <div className="benchmark-gate-icon">{gatePassed ? <CheckOutlined /> : <CloseOutlined />}</div>
          <span>RELEASE PERFORMANCE GATE</span>
          <h2>{gatePassed ? 'Candidate is safe to merge' : 'Candidate is blocked'}</h2>
          <p>
            {gatePassed
              ? 'No protected metric regressed and suite completeness meets the required threshold.'
              : `${regressions.length} protected metrics regressed${coveragePassed ? '' : ' and benchmark coverage is incomplete'}.`}
          </p>
          <div className="benchmark-gate-checks">
            <span className={regressions.length ? 'failed' : 'passed'}>
              {regressions.length ? <CloseOutlined /> : <CheckOutlined />} Regression budget
              <strong>{regressions.length ? `${regressions.length} failed` : 'passed'}</strong>
            </span>
            <span className={coveragePassed ? 'passed' : 'failed'}>
              {coveragePassed ? <CheckOutlined /> : <CloseOutlined />} Suite completeness
              <strong>{candidate?.completeness || 0}%</strong>
            </span>
            <span className={missingMetrics.length ? 'failed' : 'passed'}>
              {missingMetrics.length ? <CloseOutlined /> : <CheckOutlined />} Required metrics
              <strong>{missingMetrics.length ? `${missingMetrics.length} missing` : 'complete'}</strong>
            </span>
          </div>
        </article>
      </section>

      <section className="benchmark-panel benchmark-metrics-panel">
        <div className="benchmark-panel-head">
          <div>
            <span>HOT-PATH COMPARISON</span>
            <strong>Before / after metrics</strong>
          </div>
          <div className="benchmark-threshold-note">
            <InfoCircleOutlined /> Regression ≥ {thresholds.regressionPct}% · critical ≥ {thresholds.criticalPct}%
          </div>
        </div>
        <div className="benchmark-metric-table">
          <div className="benchmark-metric-row head">
            <span>Metric</span>
            <span>Hot path</span>
            <span>Baseline</span>
            <span>Candidate</span>
            <span>Impact</span>
            <span>Trend</span>
            <span>Status</span>
          </div>
          {comparisons.map((metric) => {
            const trendValues = projectRuns.map((run) => metricValue(run, metric.id)?.value);
            return (
              <button
                type="button"
                className={trendMetricId === metric.id ? 'benchmark-metric-row selected' : 'benchmark-metric-row'}
                onClick={() => setTrendMetricId(metric.id)}
                key={metric.id}
              >
                <span className="benchmark-metric-name">
                  <strong>{metric.name}</strong>
                  <small>{metric.category} · {metric.direction === 'higher' ? 'higher is better' : 'lower is better'}</small>
                </span>
                <span>{metric.hotPath}</span>
                <span className="numeric">{formatMetric(metric.before, metric.unit)}</span>
                <span className="numeric">
                  {formatMetric(metric.after, metric.unit)}
                  {metric.variancePct != null && <small>±{formatNumber(metric.variancePct)}%</small>}
                </span>
                <span className={`benchmark-impact ${metric.status}`}>
                  {metric.impact > 0 ? <ArrowUpOutlined /> : metric.impact < 0 ? <ArrowDownOutlined /> : null}
                  {formatDelta(metric.impact)}
                </span>
                <span><MiniSparkline values={trendValues} direction={metric.direction} /></span>
                <span><i className={`benchmark-status-pill ${metric.status}`}>{statusLabel(metric.status)}</i></span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="benchmark-bottom-grid">
        <article className="benchmark-panel benchmark-regression-panel">
          <div className="benchmark-panel-head">
            <div>
              <span>REGRESSION RADAR</span>
              <strong>Optimization targets</strong>
            </div>
            <ThunderboltOutlined />
          </div>
          <div className="benchmark-regression-list">
            {regressions.length ? regressions.map((metric) => (
              <button type="button" onClick={() => setTrendMetricId(metric.id)} key={metric.id}>
                <span className={`benchmark-regression-severity ${metric.status}`} />
                <span>
                  <strong>{metric.hotPath}</strong>
                  <small>{metric.name}</small>
                </span>
                <span>
                  <strong>{formatDelta(metric.impact)}</strong>
                  <small>{formatMetric(metric.before, metric.unit)} → {formatMetric(metric.after, metric.unit)}</small>
                </span>
              </button>
            )) : (
              <div className="benchmark-list-empty"><CheckOutlined /><span>No protected hot path regressed.</span></div>
            )}
          </div>
        </article>

        <article className="benchmark-panel benchmark-coverage-panel">
          <div className="benchmark-panel-head">
            <div>
              <span>COMPLETENESS MAP</span>
              <strong>Hot-path coverage</strong>
            </div>
            <span>{project?.hotPaths?.length || 0} paths</span>
          </div>
          <div className="benchmark-coverage-list">
            {(project?.hotPaths || []).map((path) => (
              <div key={path.id}>
                <span><strong>{path.name}</strong><small>{path.coverage}%</small></span>
                <div><i style={{ width: `${path.coverage}%` }} className={path.coverage >= 90 ? 'complete' : path.coverage >= 75 ? 'partial' : 'missing'} /></div>
              </div>
            ))}
          </div>
        </article>

        <article className="benchmark-panel benchmark-runs-panel">
          <div className="benchmark-panel-head">
            <div>
              <span>RUN HISTORY</span>
              <strong>Version evidence</strong>
            </div>
            <span>{projectRuns.length} runs</span>
          </div>
          <div className="benchmark-run-list">
            {[...projectRuns].reverse().slice(0, 5).map((run) => (
              <button
                type="button"
                className={run.id === candidateId ? 'candidate' : run.id === baselineId ? 'baseline' : ''}
                onClick={() => setCandidateId(run.id)}
                key={run.id}
              >
                <span className="benchmark-run-commit"><CodeOutlined /></span>
                <span>
                  <strong>{run.version}</strong>
                  <small>{run.versionLabel} · {new Date(run.recordedAt).toLocaleDateString()}</small>
                </span>
                <span>
                  <i className={run.source}>{run.source}</i>
                  <small>{Math.round(run.durationSeconds / 60)} min</small>
                </span>
              </button>
            ))}
          </div>
        </article>
      </section>
    </main>
  );
}

export default BenchmarkPage;
