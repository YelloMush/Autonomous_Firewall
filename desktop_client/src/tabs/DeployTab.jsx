import React, { useState, useRef, useEffect } from 'react';
import LatticeSpinner from '../components/LatticeSpinner';

const CHECKLIST_B = [
  { id:'iam',       label:'IAM Role & permissions verified' },
  { id:'vpc',       label:'Target VPC selected & validated' },
  { id:'sqs',       label:'SQS FIFO queue provisioned' },
  { id:'ec2',       label:'EC2 edge sensor AMI configured' },
  { id:'nacl',      label:'NACL rules template loaded' },
  { id:'lambda',    label:'Lambda response function ready' },
  { id:'terraform', label:'Terraform plan generated (dry-run OK)' },
];

const CHECKLIST_A = [
  { id:'cname',   label:'CNAME record pointed at edge ingress' },
  { id:'domain',  label:'Domain ownership verified (TXT record)' },
  { id:'ssl',     label:'SSL certificate issued (ACM)' },
  { id:'pop',     label:'Edge PoP registered for tenant' },
  { id:'waf',     label:'WAF ruleset attached' },
  { id:'health',  label:'Origin health check passing' },
];

const FAKE_LOGS_B = [
  'Initializing Terraform provider: hashicorp/aws v5.62…',
  'Planning infrastructure changes…',
  '  + aws_sqs_queue.aegis_edge_ingestion (fifo)',
  '  + aws_iam_role.aegis_sensor_role',
  '  + aws_instance.aegis_edge_sensor[0] (t3.micro)',
  '  + aws_network_acl.aegis_dynamic_nacl',
  '  + aws_lambda_function.aegis_response_fn',
  'Plan: 9 to add, 0 to change, 0 to destroy.',
  '',
  'Applying changes…',
  'aws_sqs_queue.aegis_edge_ingestion: Creating…',
  'aws_sqs_queue.aegis_edge_ingestion: Creation complete.',
  'aws_iam_role.aegis_sensor_role: Creating…',
  'aws_iam_role.aegis_sensor_role: Creation complete [id=aegis-sensor-role]',
  'aws_instance.aegis_edge_sensor[0]: Creating…',
  'aws_instance.aegis_edge_sensor[0]: Still creating… [10s elapsed]',
  'aws_instance.aegis_edge_sensor[0]: Creation complete [id=i-0a3b7c9d1e2f4a6b8]',
  'aws_lambda_function.aegis_response_fn: Creation complete [id=aegis-response-fn]',
  '',
  'Apply complete! Resources: 9 added, 0 changed, 0 destroyed.',
  '✓ Stack deployed. Edge IP: 54.234.17.88',
  '  SQS ARN: arn:aws:sqs:us-east-1:123456789:aegis-edge.fifo',
  '  Lambda: arn:aws:lambda:us-east-1:123456789:function:aegis-response-fn',
];

const FAKE_LOGS_A = (domain) => [
  `Resolving CNAME for ${domain}…`,
  `  ${domain}. 300 IN CNAME ingress.aegis-shield.net.`,
  'DNS propagation check across 8 resolvers…',
  '  ns1.aegis-shield.net ✓  ns2.aegis-shield.net ✓  8.8.8.8 ✓  1.1.1.1 ✓',
  'Verifying domain ownership via TXT record…',
  `  _aegis-verify.${domain} → "aegis-verify=8f2c9a1b" ✓`,
  'Requesting SSL certificate (ACM)…',
  '  Certificate issued · aegis-edge-cert-2026 · valid 90d',
  'Registering tenant with nearest edge PoP…',
  '  PoP: us-east-1-edge-04 · RTT 6.2ms',
  'Attaching WAF ruleset: aegis-managed-baseline-v3…',
  'Running origin health check…',
  `  GET https://${domain}/ → 200 OK (118ms)`,
  '',
  '✓ Edge proxy active. Traffic now routes through Aegis ingress.',
  `  Public ingress: ingress.aegis-shield.net`,
  `  Origin shielded: ${domain} (never directly exposed)`,
];

export default function DeployTab({ archMode = 'B' }) {
  const isA = archMode === 'A';

  const [arn, setArn]            = useState('');
  const [region, setRegion]      = useState('us-east-1');
  const [vpc, setVpc]            = useState('');
  const [domain, setDomain]      = useState('');
  const [checked, setChecked]    = useState({});
  const [deploying, setDeploying] = useState(false);
  const [logLines, setLogLines]  = useState([]);
  const [done, setDone]          = useState(false);
  const termRef  = useRef(null);
  const logTimer = useRef(null);

  const CHECKLIST = isA ? CHECKLIST_A : CHECKLIST_B;

  // Switching architecture mid-setup starts that mode's checklist/log fresh.
  useEffect(() => { setChecked({}); setDeploying(false); setLogLines([]); setDone(false); }, [archMode]);

  useEffect(() => () => clearTimeout(logTimer.current), []);
  useEffect(() => { if (termRef.current) termRef.current.scrollTop = termRef.current.scrollHeight; }, [logLines]);

  const allChecked = CHECKLIST.every(c => checked[c.id]);

  const startDeploy = () => {
    if (isA) { if (!domain.trim()) { alert('Enter the domain to protect.'); return; } }
    else     { if (!arn.trim())    { alert('Enter your IAM Role ARN.');     return; } }

    setDeploying(true); setDone(false); setLogLines([]);
    const lines = isA ? FAKE_LOGS_A(domain.trim()) : FAKE_LOGS_B;
    let i = 0;
    const tick = () => {
      if (i < lines.length) {
        setLogLines(prev => [...prev, lines[i++]]);
        logTimer.current = setTimeout(tick, 150 + Math.random() * 200);
      } else { setDeploying(false); setDone(true); }
    };
    tick();
  };

  return (
    <div className="fade-in" style={{
      display:'grid', gridTemplateColumns:'260px 1fr',
      gap:8, padding:8, height:'100%', overflow:'hidden',
    }}>

      {/* ── Left: Config + checklist ─────────────────────────────────── */}
      <div style={{ display:'flex', flexDirection:'column', gap:6, overflowY:'auto' }}>
        <div className="surface" style={{ padding:10 }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:2 }}>
            <div style={{ fontFamily:'Playfair Display, serif', fontSize:13, fontWeight:500, color:'var(--text-primary)' }}>
              {isA ? 'Managed Edge Proxy' : 'AWS Deployment'}
            </div>
            <span className={`badge ${isA ? 'badge-sage' : 'badge-amber'}`}>{isA ? 'Model A' : 'Model B'}</span>
          </div>
          <div style={{ fontSize:10, color:'var(--text-muted)', marginBottom:10, lineHeight:1.4 }}>
            {isA
              ? 'Route your traffic through our shared ingress — no AWS access required.'
              : 'Provision Aegis M/M/c queue model into your VPC.'}
          </div>

          {isA ? (
            <div style={{ display:'flex', flexDirection:'column', gap:7 }}>
              <div>
                <label className="form-label">Domain to protect *</label>
                <input className="form-input" placeholder="shop.example.com" value={domain} onChange={e=>setDomain(e.target.value)} disabled={deploying} />
              </div>
              <div className="surface-sub" style={{ padding:'6px 8px' }}>
                <div style={{ fontSize:9, color:'var(--text-faint)', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:3 }}>CNAME Target</div>
                <div style={{ fontFamily:'JetBrains Mono, monospace', fontSize:10, color:'var(--text-primary)' }}>ingress.aegis-shield.net</div>
              </div>
              <div style={{ display:'flex', alignItems:'center', gap:5 }}>
                <span style={{ fontSize:10, color:'var(--text-muted)' }}>Domain Verification</span>
                <span className={`badge ${done ? 'badge-sage' : 'badge-muted'}`} style={{ marginLeft:'auto' }}>
                  {done ? 'Verified' : 'Pending'}
                </span>
              </div>
            </div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:7 }}>
              <div>
                <label className="form-label">IAM Role ARN *</label>
                <input className="form-input" placeholder="arn:aws:iam::123456789:role/AegisDeployRole" value={arn} onChange={e=>setArn(e.target.value)} disabled={deploying} />
              </div>
              <div>
                <label className="form-label">Region</label>
                <select className="form-input" value={region} onChange={e=>setRegion(e.target.value)} disabled={deploying}>
                  {['us-east-1','us-west-2','eu-west-1','eu-central-1','ap-southeast-1'].map(r=>
                    <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div>
                <label className="form-label">VPC ID</label>
                <input className="form-input" placeholder="vpc-0a1b2c3d4e5f67890" value={vpc} onChange={e=>setVpc(e.target.value)} disabled={deploying} />
              </div>
            </div>
          )}
        </div>

        <div className="surface" style={{ padding:'8px 10px' }}>
          <div className="section-label">Pre-flight Checklist</div>
          <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
            {CHECKLIST.map(c => (
              <label key={c.id} style={{ display:'flex', alignItems:'center', gap:6, cursor:'pointer', fontSize:10, color:'var(--text-primary)' }}>
                <input type="checkbox" checked={!!checked[c.id]} onChange={()=>setChecked(p=>({...p,[c.id]:!p[c.id]}))}
                  style={{ accentColor:'var(--sage)', width:11, height:11 }} />
                {c.label}
              </label>
            ))}
          </div>
        </div>

        <button
          className={`btn ${allChecked && !deploying ? 'btn-sage' : 'btn-outline'} ${deploying ? 'btn-deploying deploy-shimmer' : ''}`}
          onClick={startDeploy} disabled={deploying || !allChecked}
          style={{ width:'100%', justifyContent:'center' }}
        >
          {deploying ? '⏳ Deploying…' : done ? '✓ Rerun Deploy' : isA ? '⚡ Activate Edge Proxy' : '⚡ 1-Click Deploy'}
        </button>

        {done && (
          <div className="surface" style={{ padding:'6px 8px', borderColor:'var(--sage)', background:'rgba(106,148,121,0.07)' }}>
            <div style={{ fontSize:11, color:'var(--sage)', fontWeight:600 }}>{isA ? '✓ Edge Proxy Active' : '✓ Stack Deployed'}</div>
            <div style={{ fontSize:10, color:'var(--text-muted)', marginTop:1 }}>
              {isA ? `Traffic for ${domain} now routes through Aegis` : `9 resources provisioned in ${region}`}
            </div>
          </div>
        )}
      </div>

      {/* ── Right: Deployment terminal ──────────────────────────────────── */}
      <div style={{ display:'flex', flexDirection:'column', gap:5, overflow:'hidden' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
          <div style={{ display:'flex', alignItems:'center', gap:6 }}>
            <div style={{ fontSize:11, fontWeight:600, color:'var(--text-primary)' }}>{isA ? 'Provisioning Log' : 'Terraform Log'}</div>
            {deploying && <LatticeSpinner size={13} />}
          </div>
          {logLines.length > 0 && (
            <button className="btn btn-outline" style={{ padding:'2px 7px', fontSize:10 }} onClick={()=>setLogLines([])}>
              Clear
            </button>
          )}
        </div>
        <div ref={termRef} className="terminal" style={{ flex:1 }}>
          {logLines.length === 0
            ? <span style={{ color:'var(--text-faint)' }}>{isA ? 'Complete checklist → Activate.' : 'Complete checklist → Deploy.'}<br/>{isA ? 'DNS + cert output streams here.' : 'Terraform output streams here.'}</span>
            : logLines.map((line, i) => (
                <div key={i} style={{
                  color: line.startsWith('  +') ? 'var(--sage)'
                       : line.startsWith('✓')   ? 'var(--sage)'
                       : line.includes('error')  ? 'var(--ember)'
                       : line.includes('complete') || line.includes('✓') ? 'var(--sage)'
                       : line.startsWith('Plan:') || line.startsWith('Apply') ? 'var(--amber)'
                       : 'var(--text-primary)'
                }}>{line || ' '}</div>
              ))
          }
          {deploying && <span style={{ color:'var(--amber)' }}>▌</span>}
        </div>
      </div>
    </div>
  );
}
