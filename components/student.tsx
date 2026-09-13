'use client';

import {useEffect,useState} from 'react';
import {usePathname,useRouter} from 'next/navigation';
import QRCode from 'qrcode';

import {useApp} from './provider';
import {Auth} from './auth';

import {
  Shell,
  Countdown,
  MemberFields,
  Field,
  Toggle,
  Textarea,
  Select,
  AsyncButton,
  LevelClock,
  Icon
} from './ui';

import {blankMember} from '@/lib/defaults';
import {supabase} from '@/lib/supabase';

import type {Member,Team} from '@/lib/types';


export function StudentRouter(){

  const path=usePathname();
  const router=useRouter();

  const {state,loading}=useApp();

  const mode=path.split('/')[2]||'dashboard';


  if(
    ['login','signup','forgot-password','reset-password']
      .includes(mode)
  ){
    return <Auth mode={mode}/>;
  }


  if(loading){
    return (
      <main className="auth-wrap">
        Loading your dashboard...
      </main>
    );
  }


  if(!state.profile){
    return <Auth/>;
  }


  /*
   * Admin accounts should never use the student dashboard.
   */
  if(state.profile.role==='admin'){
    router.replace('/admin');
    return null;
  }


  return <Student/>;
}



function Student(){

  const {
    state,
    act,
    notify
  }=useApp();

  const [tab,setTab]=useState('Overview');

  const me=state.profile!;

  const team=
    state.teams.find(
      t =>
        t.owner_id===me.id ||
        t.members.some(
          m =>
            m.email.toLowerCase()===
            me.email.toLowerCase()
        )
    );

  const c=state.config;

  const now=Date.now();

  const announcements=
    state.announcements.filter(
      a =>
        a.published &&
        Date.parse(a.publish_at)<=now &&
        (
          a.audience==='everyone' ||
          (
            a.audience==='checked-in' &&
            !!team?.checked_in_at
          ) ||
          (
            a.audience==='team' &&
            a.team_id===team?.id
          )
        )
    );


  return (

    <Shell
      kind="student"
      tab={tab}
      setTab={setTab}
      tabs={[
        'Overview',
        'My team',
        'QR pass',
        'Levels',
        'Announcements',
        'Change member',
        'Settings'
      ]}
    >

      {tab==='Overview' && (

        <>

          <div className="dashboard-welcome card">

            <div>

              <small className="eyebrow">
                READY TO THINK BIG?
              </small>

              <h2>
                Hey, {me.name.split(' ')[0]}.
              </h2>

              <p>
                Your journey to the next level starts here.
              </p>

              <button
                className="button"
                onClick={()=>
                  setTab(team?'QR pass':'My team')
                }
              >
                {team
                  ? 'Show my team pass'
                  : 'Create your team'}
                {' '}→
              </button>

            </div>

            <Countdown/>

          </div>


          <div className="stat-grid">

            <div className="card">
              <small>TEAM</small>
              <h3>
                {team?.name||'Not registered'}
              </h3>
            </div>

            <div className="card">
              <small>MEMBERS</small>
              <h3>
                {team?'2 / 2':'0 / 2'}
              </h3>
            </div>

            <div className="card">
              <small>CHECK-IN</small>
              <h3>
                {team?.checked_in_at
                  ? 'Checked in'
                  : 'Not checked in'}
              </h3>
            </div>

          </div>


          <h2>Your level progress</h2>

          <div className="level-grid">

            {state.levels.map(l=>

              <div
                className="card"
                key={l.id}
              >

                <span className="badge">
                  {l.status}
                </span>

                <h3>{l.name}</h3>

                <LevelClock level={l}/>

              </div>

            )}

          </div>

        </>

      )}


      {tab==='My team' && (

        team

          ? (

            <div className="card">

              <div className="section-heading">

                <div>

                  <small>{team.code}</small>

                  <h2>{team.name}</h2>

                </div>

                <span className="badge">
                  {team.status}
                </span>

              </div>


              <div className="form-grid">

                {team.members.map((m,i)=>

                  <div
                    className="member-card"
                    key={i}
                  >

                    <Icon name="Users"/>

                    <h3>{m.name}</h3>

                    <span className="badge">
                      {i===0
                        ? 'TEAM LEADER'
                        : 'MEMBER 2'}
                    </span>

                    <p>
                      {m.email}
                      <br/>
                      {m.college} · {m.branch}
                      <br/>
                      ID: {m.college_id}
                    </p>

                  </div>

                )}

              </div>


              <p>
                Registered{' '}
                {new Date(
                  team.created_at
                ).toLocaleString()}.
                {' '}
                Member replacements require organizer approval.
              </p>

            </div>

          )

          : <CreateTeam/>

      )}


      {tab==='QR pass' && (

        team

          ? <Pass team={team}/>

          : (
            <p className="empty">
              Create your team first to receive your QR pass.
            </p>
          )

      )}


      {tab==='Levels' && (

        <div className="stack">

          {state.levels.map(l=>

            <div
              className="card"
              key={l.id}
            >

              <div className="section-heading">

                <div>

                  <span className="badge">
                    LEVEL {l.id} / {l.status}
                  </span>

                  <h2>{l.name}</h2>

                </div>

                <LevelClock level={l}/>

              </div>

              <p>{l.description}</p>

              <h3>Instructions</h3>

              <p className="preline">
                {l.instructions}
              </p>

              <h3>Rules</h3>

              <p>{l.rules}</p>

              <small>
                {l.minutes} minutes · Challenges happen offline.
              </small>

            </div>

          )}

        </div>

      )}


      {tab==='Announcements' && (

        announcements.length

          ? announcements.map(a=>

              <article
                className="card"
                key={a.id}
              >

                <small>
                  {new Date(
                    a.publish_at
                  ).toLocaleString()}
                </small>

                <h2>{a.title}</h2>

                <p>{a.message}</p>

              </article>

            )

          : (
            <p className="empty">
              No announcements for your team yet.
            </p>
          )

      )}


      {tab==='Change member' && (

        team && team.owner_id===me.id

          ? <ChangeMember team={team}/>

          : (
            <p className="empty">
              Only a registered team leader can request a member change.
            </p>
          )

      )}


      {tab==='Settings' && <Settings/>}

    </Shell>

  );

}



function CreateTeam(){

  const {
    state,
    act,
    notify
  }=useApp();

  const [name,setName]=useState('');

  const [a,setA]=useState<Member>({
    ...blankMember,
    ...state.profile!
  });

  const [b,setB]=useState<Member>({
    ...blankMember
  });

  const [agreed,setAgreed]=useState(false);

  const [review,setReview]=useState(false);

  const [busy,setBusy]=useState(false);


  return (

    <form
      className="card"
      onSubmit={async e=>{

        e.preventDefault();

        if(!review){

          setReview(true);

          return;

        }

        setBusy(true);

        try{

          const clean=(m:Member)=>
            Object.fromEntries(
              Object.keys(blankMember).map(
                k=>[
                  k,
                  m[k as keyof Member]
                ]
              )
            );

          await act(
            'create_team',
            {
              name,
              members:[
                clean(a),
                clean(b)
              ],
              agreed
            }
          );

        }catch(err){

          notify(
            err instanceof Error
              ? err.message
              : 'Registration failed.'
          );

        }finally{

          setBusy(false);

        }

      }}
    >

      <span className="badge">
        EXACTLY 2 MEMBERS
      </span>

      <h2>
        {review
          ? 'Review your registration'
          : 'Build your dream team.'}
      </h2>


      {!review ? (

        <>

          <Field
            label="Team name"
            required
            minLength={2}
            maxLength={80}
            value={name}
            onChange={e=>
              setName(e.target.value)
            }
          />


          <h3>
            Member 1 / team leader
          </h3>

          <MemberFields
            value={
              Object.fromEntries(
                Object.keys(blankMember).map(
                  k=>[
                    k,
                    a[k as keyof Member]
                  ]
                )
              ) as Member
            }
            onChange={setA}
            leader
          />


          <h3>
            Member 2
          </h3>

          <MemberFields
            value={b}
            onChange={setB}
          />

        </>

      ) : (

        <div className="review">

          <h3>{name}</h3>

          <p>
            {a.name} ({a.email})
            <br/>
            {b.name} ({b.email})
          </p>

          <p>
            Team size: 2 / 2.
            Both members must be unique participants.
          </p>

        </div>

      )}


      <Toggle
        label="I agree to the event rules and confirm both members' details."
        value={agreed}
        onChange={setAgreed}
      />


      <div className="actions">

        {review && (

          <button
            type="button"
            className="button secondary"
            onClick={()=>
              setReview(false)
            }
          >
            Edit details
          </button>

        )}


        <button
          className="button"
          disabled={!agreed||busy}
        >
          {busy
            ? 'Submitting...'
            : review
              ? 'Confirm and register'
              : 'Review team'}
          {' '}→
        </button>

      </div>

    </form>

  );

}



function Pass({
  team
}:{
  team:Team
}){

  const {state}=useApp();

  const [qr,setQr]=useState('');

  const [error,setError]=useState('');


  useEffect(()=>{

    QRCode.toDataURL(
      team.qr_token,
      {
        width:320,
        margin:2,
        errorCorrectionLevel:'M'
      }
    )
      .then(setQr)
      .catch(()=>
        setError(
          'Unable to create QR image. Please refresh.'
        )
      );

  },[team.qr_token]);


  return (

    <div className="pass-area">

      <div className="team-pass">

        <div className="pass-header">

          <Icon name="Brain"/>

          {state.config.name}

          <span>
            TEAM PASS
          </span>

        </div>


        <h2>{team.name}</h2>

        <p className="pass-code">
          {team.code}
        </p>


        {qr

          ? (
            <img
              src={qr}
              width="240"
              height="240"
              alt={
                'QR check-in pass for '+
                team.name
              }
            />
          )

          : (
            <p>
              {error||'Creating QR pass...'}
            </p>
          )

        }


        <div className="pass-members">

          {team.members.map((m,i)=>

            <div key={i}>

              <small>
                {i===0
                  ? 'LEADER'
                  : 'MEMBER'}
              </small>

              <strong>
                {m.name}
              </strong>

            </div>

          )}

        </div>


        <span className="badge">

          {team.status}
          {' · '}
          {team.checked_in_at
            ? 'CHECKED IN'
            : 'AWAITING CHECK-IN'}

        </span>


        <p>{state.config.venue}</p>

      </div>


      <div className="actions no-print">

        <button
          className="button"
          onClick={()=>window.print()}
        >
          Print / save as PDF
        </button>


        {qr && (

          <a
            className="button secondary"
            download={team.code+'-qr.png'}
            href={qr}
          >
            Download QR
          </a>

        )}

      </div>


      <p className="no-print">
        Bring your student IDs.
        Keep this pass private;
        it is your team's check-in token.
      </p>

    </div>

  );

}



function ChangeMember({
  team
}:{
  team:Team
}){

  const {
    state,
    act,
    notify
  }=useApp();

  const [member,setMember]=useState<Member>({
    ...blankMember
  });

  const [reason,setReason]=useState('');

  const [busy,setBusy]=useState(false);


  return (

    <>

      <form
        className="card"
        onSubmit={async e=>{

          e.preventDefault();

          setBusy(true);

          try{

            await act(
              'request_change',
              {
                member,
                reason
              }
            );

            setReason('');

          }catch(err){

            notify(
              err instanceof Error
                ? err.message
                : 'Request failed.'
            );

          }finally{

            setBusy(false);

          }

        }}
      >

        <h2>
          Request a member replacement
        </h2>

        <p>
          Current member:
          {' '}
          {team.members[1].name}.
          {' '}
          No change is made until an organizer approves.
        </p>

        <MemberFields
          value={member}
          onChange={setMember}
        />

        <Textarea
          label="Reason"
          required
          value={reason}
          onChange={e=>
            setReason(e.target.value)
          }
        />

        <button
          className="button"
          disabled={busy}
        >
          {busy
            ? 'Sending...'
            : 'Send request'}
        </button>

      </form>


      {state.requests
        .filter(r=>r.team_id===team.id)
        .map(r=>

          <div
            className="card"
            key={r.id}
          >

            <span className="badge">
              {r.status}
            </span>

            <h3>{r.member.name}</h3>

            <p>{r.reason}</p>

          </div>

        )}

    </>

  );

}



function Settings(){

  const {
    state,
    act,
    notify
  }=useApp();

  const [profile,setProfile]=useState(
    state.profile!
  );

  const [password,setPassword]=useState('');


  return (

    <div className="stack">

      <div className="card">

        <h2>Your profile</h2>

        <MemberFields
          value={
            Object.fromEntries(
              Object.keys(blankMember).map(
                k=>[
                  k,
                  profile[k as keyof Member]
                ]
              )
            ) as Member
          }
          onChange={m=>
            setProfile({
              ...profile,
              ...m
            })
          }
        />

        <p>
          Your login email stays unchanged.
          Team pass details remain locked after registration.
        </p>

        <AsyncButton
          run={()=>
            act(
              'profile',
              {
                ...profile,
                email:state.profile!.email
              }
            )
          }
        >
          Save profile
        </AsyncButton>

      </div>


      <div className="card">

        <h2>Appearance</h2>

        <Select
          label="Your dashboard theme"
          value={state.profile!.theme}
          options={['dark','light']}
          onChange={e=>
            void act(
              'profile',
              {
                theme:e.target.value
              }
            ).catch(err=>
              notify(err.message)
            )
          }
        />

        <p>
          This changes only your dashboard,
          not the official event website.
        </p>

      </div>


      <div className="card">

        <h2>Account security</h2>

        <Field
          label="New password (at least 8 characters)"
          type="password"
          minLength={8}
          value={password}
          onChange={e=>
            setPassword(e.target.value)
          }
        />


        <AsyncButton
          run={async()=>{

            if(!supabase){
              throw Error(
                'Supabase is not configured.'
              );
            }

            if(password.length<8){
              throw Error(
                'Use at least 8 characters.'
              );
            }

            const {error}=
              await supabase.auth.updateUser({
                password
              });

            if(error) throw error;

            setPassword('');

            notify('Password updated.');

          }}
        >
          Update password
        </AsyncButton>

      </div>

    </div>

  );

}