import React, { useState, useRef, useEffect } from 'react';

const CHECKLIST = [
  { id: 'iam',       label: 'IAM Role & permissions verified' },
  { id: 'vpc',       label: 'Target VPC selected & validated' },
  { id: 'sqs',       label: 'SQS FIFO queue provisioned' },
  { id: 'ec2',       label: 'EC2 edge sensor AMI configured' },
  { id: 'nacl',      label: 'NACL rules template loaded' },
  { id: 'lambda',    label: 'Lambda response function ready' },
  { id: 'terraform', label: 'Terraform plan generated (dry-run OK)' },
];

const FAKE_LOGS = [
  'Initializing Terraform provider: hashicorp/aws v5.62…',
  'Planning infrastructure changes…',
  '  + aws_sqs_queue.aegis_edge_ingestion (fifo)',
  '  + aws_iam_role.aegis_sensor_role',
  '  + aws_iam_role_policy_attachment.sensor_sqs',
  '  + aws_instance.aegis_edge_sensor[0] (t3.micro)',
  '  + aws_network_acl.aegis_dynamic_nacl',
  '  + aws_lambda_function.aegis_response_fn',
  '  + aws_cloudwatch_metric_alarm.anomaly_trigger',
  'Plan: 9 to add, 0 to change, 0 to destroy.',
  '',
  'Applying changes…',
  'aws_sqs_queue.aegis_edge_ingestion: Creating…',
  'aws_sqs_queue.aegis_edge_ingestion: Creation complete [id=https://sqs.us-east-1.amazonaws.com/]',
  'aws_iam_role.aegis_sensor_role: Creating…',
  'aws_iam_role.aegis_sensor_role: Creation complete [id=aegis-sensor-role]',
  'aws_instance.aegis_edge_sensor[0]: Creating…',
  'aws_instance.aegis_edge_sensor[0]: Still creating… [10s elapsed]',
  'aws_instance.aegis_edge_sensor[0]: Still creating… [20s elapsed]',
  'aws_instance.aegis_edge_sensor[0]: Creation complete [id=i-0a3b7c9d1e2f4a6b8]',
  'aws_lambda_function.aegis_response_fn: Creating…',
  'aws_lambda_function.aegis_response_fn: Creation complete [id=aegis-response-fn]',
  '',
  'Apply complete! Resources: 9 added, 0 changed, 0 destroyed.',
  '',
  '✓ Aegis VPC stack deployed successfully.',
  '  Edge Sensor IP: 54.234.17.88',
  '  SQS ARN: arn:aws:sqs:us-east-1:123456789:aegis-edge.fifo',
  '  Lambda ARN: arn:aws:lambda:us-east-1:123456789:function:aegis-response-fn',
  '  Dashboard URL: http://54.234.17.88:8000',
];

export default function DeployTab() {
  const [arn, setArn] = useState('');
  const [region, setRegion] = useState('us-east-1');
  const [vpc, setVpc] = useState('');
  const [checked, setChecked] = useState({});
  const [deploying, setDeploying] = useState(false);
  const [logLines, setLogLines] = useState([]);
  const [done, setDone] = useState(false);
  const termRef = useRef(null);
  let logTimer = useRef(null);

  useEffect(() => () => clearTimeout(logTimer.current), []);

  useEffect(() => {
    if (termRef.current) termRef.current.scrollTop = termRef.current.scrollHeight;
  }, [logLines]);

  const toggleCheck = (id) => setChecked(prev => ({ ...prev, [id]: !prev[id] }));
  const allChecked = CHECKLIST.every(c => checked[c.id]);

  const startDeploy = () => {
    if (!arn.trim()) { alert('Please enter your IAM Role ARN.'); return; }
    setDeploying(true);
    setDone(false);
    setLogLines([]);

    let i = 0;
    const tick = () => {
      if (i < FAKE_LOGS.length) {
        setLogLines(prev => [...prev, FAKE_LOGS[i]]);
        i++;
        logTimer.current = setTimeout(tick, 180 + Math.random() * 220);
      } else {
        setDeploying(false);
        setDone(true);
      }
    };
    tick();
  };

  return (
    <div className="fade-in" style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 12, height: '100%', padding: 16, overflow: 'hidden' }}>

      {/* ── Left: Config + checklist ───────────────────────────────── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, overflowY: 'auto' }}>
        <div className="surface" style={{ padding: 14 }}>
          <div style={{ fontFamily: 'Playfair Display, serif', fontSize: 16, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 2 }}>AWS Infrastructure</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 14, lineHeight: 1.5 }}>Deploy Aegis M/M/c queue model directly into your AWS VPC with one click.</div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div>
              <label className="form-label">IAM Role ARN *</label>
              <input className="form-input" placeholder="arn:aws:iam::123456789:role/AegisDeployRole" value={arn} onChange={e => setArn(e.target.value)} />
            </div>
            <div>
              <label className="form-label">AWS Region</label>
              <select className="form-input" value={region} onChange={e => setRegion(e.target.value)}>
                {['us-east-1','us-west-2','eu-west-1','eu-central-1','ap-southeast-1'].map(r => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="form-label">Target VPC ID</label>
              <input className="form-input" placeholder="vpc-0a1b2c3d4e5f67890" value={vpc} onChange={e => setVpc(e.target.value)} />
            </div>
          </div>
        </div>

        {/* Pre-flight checklist */}
        <div className="surface" style={{ padding: 14 }}>
          <div className="section-label">Pre-flight Checklist</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {CHECKLIST.map(c => (
              <label key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 11, color: 'var(--text-primary)' }}>
                <input type="checkbox" checked={!!checked[c.id]} onChange={() => toggleCheck(c.id)}
                  style={{ accentColor: 'var(--sage)', width: 13, height: 13 }} />
                {c.label}
              </label>
            ))}
          </div>
        </div>

        {/* Deploy button */}
        <button
          className={`btn ${allChecked && !deploying ? 'btn-sage' : 'btn-outline'}`}
          onClick={startDeploy}
          disabled={deploying || !allChecked}
          style={{ width: '100%', justifyContent: 'center', padding: '9px 0' }}
        >
          {deploying ? '⏳  Deploying…' : done ? '✓  Rerun Deployment' : '⚡  Execute 1-Click Deploy'}
        </button>

        {done && (
          <div className="surface" style={{ padding: 10, background: 'rgba(106,148,121,0.08)', borderColor: 'var(--sage)' }}>
            <div style={{ fontSize: 11, color: 'var(--sage)', fontWeight: 600 }}>✓ Stack Deployed</div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>All 9 resources provisioned in us-east-1</div>
          </div>
        )}
      </div>

      {/* ── Right: Terraform terminal ──────────────────────────────── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>Terraform Execution Log</div>
          {(logLines.length > 0) && (
            <button className="btn btn-outline" style={{ padding: '3px 10px', fontSize: 11 }} onClick={() => setLogLines([])}>
              Clear
            </button>
          )}
        </div>
        <div
          ref={termRef}
          className="terminal"
          style={{ flex: 1, fontSize: 11 }}
        >
          {logLines.length === 0 ? (
            <span style={{ color: 'var(--text-faint)' }}>Complete the checklist and click Deploy to begin.{"\n"}
Terraform output will stream here in real-time.</span>
          ) : (
            logLines.map((line, i) => (
              <div key={i} style={{
                color: line.startsWith('  +') ? 'var(--sage)'
                     : line.startsWith('✓') ? 'var(--sage)'
                     : line.includes('error') || line.includes('Error') ? 'var(--ember)'
                     : line.includes('complete') ? 'var(--sage)'
                     : line.startsWith('Plan:') || line.startsWith('Apply') ? 'var(--amber)'
                     : 'var(--text-primary)'
              }}>{line || '\u00A0'}</div>
            ))
          )}
          {deploying && <span style={{ color: 'var(--amber)' }}>▌</span>}
        </div>
      </div>
    </div>
  );
}
