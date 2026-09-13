'use client';

import {useEffect,useState} from 'react';
import {usePathname,useRouter} from 'next/navigation';
import {useApp} from './provider';
import {Auth} from './auth';
import {
  Shell,
  AsyncButton,
  Field,
  Select,
  Textarea,
  Toggle,
  Modal,
  LevelClock,
  Icon
} from './ui';
import {ConfigEditor} from './editors';
import {Scanner} from './scanner';
import {csv} from '@/lib/ranking';
import type {Team,Level,Announcement} from '@/lib/types';

export function AdminRouter(){
  const path=usePathname();
  const router=useRouter();
  const {state,loading,error}=useApp();

  if(path==='/admin/login'){
    return <Auth admin/>;
  }

  if(loading){
    return (
      <main className="auth-wrap">
        Loading the control room...
      </main>
    );
  }

  if(error){
    return (
      <main className="auth-wrap">
        <h1>Unable to load admin dashboard</h1>
        <p>{error}</p>
        <a className="button" href="/admin/login">
          Login again
        </a>
      </main>
    );
  }

  if(!state.profile){
    return <Auth admin/>;
  }

  if(state.profile.role!=='admin'){
    return (
      <main className="auth-wrap">
        <h1>Organizer access only.</h1>

        <p>
          Your account does not have administrator permissions.
        </p>

        <button
          className="button"
          onClick={()=>router.replace('/student/dashboard')}
        >
          Student dashboard
        </button>
      </main>
    );
  }

  return <Admin/>;
}

const tabs=[
  'Overview',
  'Home',
  'About',
  'Why participate',
  'How it works',
  'Rules',
  'Design',
  'Event settings',
  'Registration',
  'Teams',
  'Change requests',
  'Check-in',
  'Attendance',
  'Levels',
  'Announcements',
  'Export data',
  'Activity log'
];

function Admin(){
  const {state,act}=useApp();

  const [tab,setTab]=useState('Overview');

  const checked=state.teams.filter(
    t=>t.checked_in_at
  ).length;

  const configTabs=[
    'Home',
    'About',
    'Why participate',
    'How it works',
    'Rules',
    'Design',
    'Event settings',
    'Registration'
  ];

  return (
    <Shell
      kind="admin"
      tab={tab}
      setTab={setTab}
      tabs={tabs}
    >

      {tab==='Overview'&&(
        <>
          <div className="dashboard-welcome card">
            <div>
              <small className="eyebrow">
                EVERY GREAT EVENT STARTS HERE
              </small>

              <h2>You're in control.</h2>

              <p>
                Manage the experience. Let the minds do the rest.
              </p>
            </div>

            <Icon name="Brain" size={90}/>
          </div>

          <div className="stat-grid">
            {[
              ['Total teams',state.team_count],
              [
                'Confirmed',
                state.teams.filter(
                  t=>t.status==='confirmed'
                ).length
              ],
              ['Checked in',checked],
              [
                'Not checked in',
                state.team_count-checked
              ]
            ].map(([a,b])=>(
              <div className="card" key={String(a)}>
                <small>{a}</small>
                <h2>{b}</h2>
              </div>
            ))}
          </div>

          <div className="level-grid">
            {state.levels.map(l=>(
              <div className="card" key={l.id}>
                <span className="badge">
                  {l.status}
                </span>

                <h3>{l.name}</h3>

                <LevelClock level={l}/>
              </div>
            ))}
          </div>

          <div className="card event-focus">
            <h3>Event-day focus</h3>

            <p>
              Keep registration, QR check-in,
              attendance and level controls ready
              for the live event.
            </p>

            <button
              className="button secondary"
              onClick={()=>setTab('Check-in')}
            >
              Open check-in →
            </button>
          </div>
        </>
      )}

      {configTabs.includes(tab)&&(
        <ConfigEditor
          section={tab}
          key={tab}
        />
      )}

      {(tab==='Teams'||
        tab==='Attendance'||
        tab==='Check-in')&&(
        <Teams mode={tab}/>
      )}

      {tab==='Change requests'&&(
        <div className="stack">
          {state.requests.length?
            state.requests.map(r=>(
              <div className="card" key={r.id}>
                <span className="badge">
                  {r.status}
                </span>

                <h2>
                  {
                    state.teams.find(
                      t=>t.id===r.team_id
                    )?.name
                  }
                </h2>

                <p>
                  Replacement:{' '}
                  <strong>{r.member.name}</strong>{' '}
                  ({r.member.email})
                </p>

                <p>
                  {r.member.college} ·{' '}
                  {r.member.college_id} ·{' '}
                  {r.member.branch} ·{' '}
                  {r.member.phone}
                </p>

                <p>{r.reason}</p>

                {r.status==='pending'&&(
                  <div className="actions">
                    <AsyncButton
                      run={()=>act(
                        'review_change',
                        {
                          id:r.id,
                          approve:true
                        }
                      )}
                    >
                      Approve
                    </AsyncButton>

                    <AsyncButton
                      className="button secondary"
                      run={()=>act(
                        'review_change',
                        {
                          id:r.id,
                          approve:false
                        }
                      )}
                    >
                      Reject
                    </AsyncButton>
                  </div>
                )}
              </div>
            ))
            :
            <p className="empty">
              No member change requests.
            </p>
          }
        </div>
      )}

      {tab==='Levels'&&(
        <div className="stack">
          {state.levels.map(l=>(
            <LevelEditor
              level={l}
              key={l.id}
            />
          ))}
        </div>
      )}

      {tab==='Announcements'&&(
        <Announcements/>
      )}

      {tab==='Export data'&&(
        <Exports/>
      )}

      {tab==='Activity log'&&(
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Time</th>
                <th>Action</th>
              </tr>
            </thead>

            <tbody>
              {state.logs.map((l,i)=>(
                <tr key={i}>
                  <td>
                    {new Date(
                      l.created_at
                    ).toLocaleString()}
                  </td>

                  <td>
                    {l.action}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <p>
            Showing the latest 100 recorded actions.
          </p>
        </div>
      )}
    </Shell>
  );
}

function Teams({mode}:{mode:string}){
  const {state,act,notify}=useApp();

  const [search,setSearch]=useState('');
  const [attendance,setAttendance]=useState('All');
  const [status,setStatus]=useState('All');
  const [college,setCollege]=useState('');
  const [branch,setBranch]=useState('');
  const [selected,setSelected]=useState<string|null>(null);

  const team=state.teams.find(
    t=>t.id===selected
  );

  const rows=state.teams.filter(t=>
    (t.name+' '+t.code)
      .toLowerCase()
      .includes(search.toLowerCase())

    &&

    (
      attendance==='All' ||
      (
        attendance==='Checked in'
        ? !!t.checked_in_at
        : !t.checked_in_at
      )
    )

    &&

    (
      status==='All' ||
      t.status===status
    )

    &&

    t.members.some(m=>
      m.college
        .toLowerCase()
        .includes(college.toLowerCase())
    )

    &&

    t.members.some(m=>
      m.branch
        .toLowerCase()
        .includes(branch.toLowerCase())
    )
  );

  const scan=(token:string)=>{
    const value=token.trim();

    const t=state.teams.find(
      t=>
        t.qr_token===value ||
        t.code===value
    );

    if(t){
      setSelected(t.id);
    }else{
      notify(
        'No matching team pass. Check the token or Team ID.'
      );
    }
  };

  return (
    <>
      {mode==='Check-in'&&(
        <Scanner onScan={scan}/>
      )}

      <div className="filters">

        <Field
          label="Search name / Team ID"
          value={search}
          onChange={e=>setSearch(e.target.value)}
        />

        <Select
          label="Check-in"
          options={[
            'All',
            'Checked in',
            'Not checked in'
          ]}
          value={attendance}
          onChange={e=>
            setAttendance(e.target.value)
          }
        />

        <Select
          label="Status"
          options={[
            'All',
            'confirmed',
            'disqualified'
          ]}
          value={status}
          onChange={e=>
            setStatus(e.target.value)
          }
        />

        <Field
          label="College"
          value={college}
          onChange={e=>
            setCollege(e.target.value)
          }
        />

        <Field
          label="Department"
          value={branch}
          onChange={e=>
            setBranch(e.target.value)
          }
        />

      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Team ID</th>
              <th>Team</th>
              <th>Members</th>
              <th>Status</th>
              <th>Check-in</th>
              <th>Details</th>
            </tr>
          </thead>

          <tbody>
            {rows.map(t=>(
              <tr key={t.id}>
                <td>{t.code}</td>

                <td>
                  <strong>{t.name}</strong>
                  <small>
                    {t.members[0]?.college}
                  </small>
                </td>

                <td>
                  {t.members.length} / 2
                </td>

                <td>
                  <span className="badge">
                    {t.status}
                  </span>
                </td>

                <td>
                  {t.checked_in_at
                    ? 'Checked in'
                    : 'Not yet'}
                </td>

                <td>
                  <button
                    className="text-button"
                    onClick={()=>
                      setSelected(t.id)
                    }
                  >
                    Review →
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {!rows.length&&(
          <p className="empty">
            No matching teams.
          </p>
        )}
      </div>

      {team&&(
        <Modal
          title={team.name}
          onClose={()=>
            setSelected(null)
          }
        >
          <p>
            {team.code} · {team.status}
          </p>

          {team.members.map((m,i)=>(
            <div
              className="member-card"
              key={i}
            >
              <h3>
                {m.name} /{' '}
                {i===0
                  ? 'Leader'
                  : 'Member'}
              </h3>

              <p>
                {m.email} · {m.phone}
                <br/>
                {m.college} · {m.college_id}
                <br/>
                {m.branch} · Semester {m.semester}
              </p>
            </div>
          ))}

          <p>
            Registration:{' '}
            {new Date(
              team.created_at
            ).toLocaleString()}

            <br/>

            Check-in:{' '}
            {team.checked_in_at
              ? new Date(
                  team.checked_in_at
                ).toLocaleString()
              : 'Not checked in'}
          </p>

          <div className="actions">

            {!team.checked_in_at &&
              team.status==='confirmed'&&(
                <AsyncButton
                  run={()=>act(
                    'checkin',
                    {id:team.id}
                  )}
                >
                  Verify and check in
                </AsyncButton>
              )}

            <AsyncButton
              className="button secondary"
              run={async()=>{
                if(
                  confirm(
                    'Change team status?'
                  )
                ){
                  await act(
                    'team_status',
                    {
                      id:team.id,
                      status:
                        team.status==='confirmed'
                          ? 'disqualified'
                          : 'confirmed'
                    }
                  );
                }
              }}
            >
              {team.status==='confirmed'
                ? 'Disqualify'
                : 'Restore team'}
            </AsyncButton>

          </div>
        </Modal>
      )}
    </>
  );
}

function LevelEditor({level}:{level:Level}){
  const {act}=useApp();

  const [l,setL]=useState(level);

  useEffect(()=>{
    setL(prev=>({
      ...prev,
      status:level.status,
      started_at:level.started_at,
      remaining:level.remaining
    }));
  },[
    level.status,
    level.started_at,
    level.remaining
  ]);

  const patch=(
    k:keyof Level,
    v:unknown
  )=>{
    setL({
      ...l,
      [k]:v
    });
  };

  return (
    <div className="card">

      <div className="section-heading">
        <div>
          <span className="badge">
            LEVEL {l.id} / {level.status}
          </span>

          <h2>{l.name}</h2>
        </div>

        <LevelClock level={level}/>
      </div>

      <div className="form-grid">

        <Field
          label="Name"
          value={l.name}
          onChange={e=>
            patch('name',e.target.value)
          }
        />

        <Field
          label="Short description"
          value={l.short}
          onChange={e=>
            patch('short',e.target.value)
          }
        />

        <Field
          label="Minutes"
          type="number"
          min="1"
          value={l.minutes}
          onChange={e=>
            patch(
              'minutes',
              Number(e.target.value)
            )
          }
        />

        <Field
          label="Maximum score"
          type="number"
          min="1"
          value={l.maximum}
          onChange={e=>
            patch(
              'maximum',
              Number(e.target.value)
            )
          }
        />

        <Select
          label="Difficulty"
          options={[
            'Easy',
            'Medium',
            'Hard'
          ]}
          value={l.difficulty}
          onChange={e=>
            patch(
              'difficulty',
              e.target.value
            )
          }
        />

      </div>

      <Textarea
        label="Description"
        value={l.description}
        onChange={e=>
          patch(
            'description',
            e.target.value
          )
        }
      />

      <Textarea
        label="Instructions"
        value={l.instructions}
        onChange={e=>
          patch(
            'instructions',
            e.target.value
          )
        }
      />

      <Textarea
        label="Rules"
        value={l.rules}
        onChange={e=>
          patch(
            'rules',
            e.target.value
          )
        }
      />

      <Toggle
        label="Visible on public website"
        value={l.visible}
        onChange={v=>
          patch('visible',v)
        }
      />

      <div className="actions">

        <AsyncButton
          className="button secondary"
          run={()=>
            act(
              'save_level',
              {level:l}
            )
          }
        >
          Save level details
        </AsyncButton>

        {(level.status==='upcoming'
          ? ['start']
          : level.status==='active'
          ? ['pause','end']
          : level.status==='paused'
          ? ['resume','end']
          : []
        ).map(command=>(
          <AsyncButton
            key={command}
            run={async()=>{
              if(
                command!=='end' ||
                confirm(
                  'End and lock this level?'
                )
              ){
                await act(
                  'level_control',
                  {
                    id:l.id,
                    command
                  }
                );
              }
            }}
          >
            {command} level
          </AsyncButton>
        ))}

      </div>
    </div>
  );
}

function Announcements(){
  const {state,act}=useApp();

  const fresh=():Announcement=>({
    id:'',
    title:'',
    message:'',
    audience:'everyone',
    team_id:'',
    published:false,
    publish_at:new Date().toISOString()
  });

  const [item,setItem]=useState<Announcement>(
    fresh
  );

  return (
    <>
      <div className="card">

        <h2>
          {item.id
            ? 'Edit announcement'
            : 'New announcement'}
        </h2>

        <Field
          label="Title"
          value={item.title}
          onChange={e=>
            setItem({
              ...item,
              title:e.target.value
            })
          }
        />

        <Textarea
          label="Message"
          value={item.message}
          onChange={e=>
            setItem({
              ...item,
              message:e.target.value
            })
          }
        />

        <div className="form-grid">

          <Select
            label="Audience"
            options={[
              'everyone',
              'checked-in',
              'team'
            ]}
            value={item.audience}
            onChange={e=>
              setItem({
                ...item,
                audience:
                  e.target.value as Announcement['audience']
              })
            }
          />

          <Field
            label="Publish time (ISO 8601 with timezone)"
            value={item.publish_at}
            onChange={e=>
              setItem({
                ...item,
                publish_at:e.target.value
              })
            }
          />

        </div>

        {item.audience==='team'&&(
          <label className="field">
            <span>Team</span>

            <select
              value={item.team_id}
              onChange={e=>
                setItem({
                  ...item,
                  team_id:e.target.value
                })
              }
            >
              <option value="">
                Select a team
              </option>

              {state.teams.map(t=>(
                <option
                  key={t.id}
                  value={t.id}
                >
                  {t.code} · {t.name}
                </option>
              ))}
            </select>
          </label>
        )}

        <Toggle
          label="Published (visible at the scheduled time)"
          value={item.published}
          onChange={v=>
            setItem({
              ...item,
              published:v
            })
          }
        />

        <div className="actions">

          <AsyncButton
            run={async()=>{
              if(
                !item.title.trim() ||
                !item.message.trim() ||
                !Number.isFinite(
                  Date.parse(item.publish_at)
                ) ||
                (
                  item.audience==='team' &&
                  !item.team_id
                )
              ){
                throw Error(
                  'Complete the title, message, valid publish time, and audience.'
                );
              }

              await act(
                'announcement',
                {item}
              );

              setItem(fresh());
            }}
          >
            Save announcement
          </AsyncButton>

          <button
            className="button secondary"
            onClick={()=>
              setItem(fresh())
            }
          >
            Clear
          </button>

        </div>
      </div>

      {state.announcements.map(a=>(
        <div
          className="card"
          key={a.id}
        >
          <span className="badge">
            {a.audience} /{' '}
            {a.published
              ? 'published'
              : 'draft'}
          </span>

          <h3>{a.title}</h3>

          <p>{a.message}</p>

          <div className="actions">

            <button
              className="button secondary"
              onClick={()=>
                setItem(a)
              }
            >
              Edit
            </button>

            <AsyncButton
              className="button secondary"
              run={async()=>{
                if(
                  confirm(
                    'Delete this announcement?'
                  )
                ){
                  await act(
                    'delete_announcement',
                    {id:a.id}
                  );
                }
              }}
            >
              Delete
            </AsyncButton>

          </div>
        </div>
      ))}
    </>
  );
}

function Exports(){
  const {state}=useApp();

  function download(kind:string){
    let rows:Record<string,unknown>[]=[];

    if(kind==='Teams'){
      rows=state.teams.map(t=>({
        team_id:t.code,
        name:t.name,
        status:t.status,
        registered_at:t.created_at
      }));
    }

    if(kind==='Members'){
      rows=state.teams.flatMap(t=>
        t.members.map((m,i)=>({
          team_id:t.code,
          role:i===0
            ? 'leader'
            : 'member',
          ...m
        }))
      );
    }

    if(kind==='Attendance'){
      rows=state.teams.map(t=>({
        team_id:t.code,
        team:t.name,
        checked_in:!!t.checked_in_at,
        checked_in_at:t.checked_in_at
      }));
    }

    const url=URL.createObjectURL(
      new Blob(
        [csv(rows)],
        {
          type:'text/csv;charset=utf-8'
        }
      )
    );

    const a=document.createElement('a');

    a.href=url;

    a.download=
      'mind-rizz-' +
      kind.toLowerCase() +
      '.csv';

    a.click();

    setTimeout(
      ()=>URL.revokeObjectURL(url),
      1000
    );
  }

  return (
    <div className="benefit-grid">

      {[
        'Teams',
        'Members',
        'Attendance'
      ].map(k=>(
        <div
          className="card"
          key={k}
        >
          <Icon name="Sparkles"/>

          <h3>{k}</h3>

          <p>
            {k==='Members'
              ? 'Contains personal information. Store and share securely.'
              : 'Download a spreadsheet-compatible CSV.'}
          </p>

          <button
            className="button secondary"
            onClick={()=>download(k)}
          >
            Export {k} CSV
          </button>
        </div>
      ))}

    </div>
  );
}