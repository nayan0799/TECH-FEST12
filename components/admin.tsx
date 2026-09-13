'use client';

import { useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';

import { useApp } from './provider';
import { Auth } from './auth';
import { Shell } from './ui';

export function AdminRouter() {
  const pathname = usePathname();
  const router = useRouter();

  const { state, loading, error } = useApp();

  /*
   * IMPORTANT:
   * Always allow /admin/login to render the login page.
   * Do this before checking loading/profile.
   */
  if (pathname === '/admin/login') {
    return <Auth admin />;
  }

  if (loading) {
    return (
      <main className="auth-wrap">
        <div className="card">
          <h1>Loading the control room...</h1>
          <p>Please wait.</p>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="auth-wrap">
        <div className="card">
          <h1>Unable to load admin dashboard</h1>

          <p>{error}</p>

          <button
            className="button"
            onClick={() => router.replace('/admin/login')}
          >
            Login again
          </button>
        </div>
      </main>
    );
  }

  /*
   * No authenticated profile.
   */
  if (!state.profile) {
    return <Auth admin />;
  }

  /*
   * Logged in but not an admin.
   */
  if (state.profile.role !== 'admin') {
    return (
      <main className="auth-wrap">
        <div className="card">
          <h1>Organizer access only.</h1>

          <p>
            Your account does not have administrator permissions.
          </p>

          <button
            className="button"
            onClick={() => router.replace('/student/dashboard')}
          >
            Student dashboard
          </button>

          <button
            className="button secondary"
            onClick={() => router.replace('/admin/login')}
          >
            Use another account
          </button>
        </div>
      </main>
    );
  }

  return <Admin />;
}


const tabs = [
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
  'Activity log',
];


function Admin() {
  const { state } = useApp();

  const [tab, setTab] = useState('Overview');

  const checked = state.teams.filter(
    team => !!team.checked_in_at
  ).length;

  return (
    <Shell
      kind="admin"
      tab={tab}
      setTab={setTab}
      tabs={tabs}
    >
      {tab === 'Overview' && (
        <Overview
          checked={checked}
          setTab={setTab}
        />
      )}

      {[
        'Home',
        'About',
        'Why participate',
        'How it works',
        'Rules',
        'Design',
        'Event settings',
        'Registration',
      ].includes(tab) && (
        <ConfigEditor
          section={tab}
          key={tab}
        />
      )}

      {(
        tab === 'Teams' ||
        tab === 'Attendance' ||
        tab === 'Check-in'
      ) && (
        <Teams mode={tab} />
      )}

      {tab === 'Change requests' && (
        <ChangeRequests />
      )}

      {tab === 'Levels' && (
        <Levels />
      )}

      {tab === 'Announcements' && (
        <Announcements />
      )}

      {tab === 'Export data' && (
        <Exports />
      )}

      {tab === 'Activity log' && (
        <ActivityLog />
      )}
    </Shell>
  );
}


function Overview({
  checked,
  setTab,
}: {
  checked: number;
  setTab: (tab: string) => void;
}) {
  const { state } = useApp();

  return (
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

        <div style={{ fontSize: 70 }}>
          🧠
        </div>
      </div>

      <div className="stat-grid">
        <div className="card">
          <small>Total teams</small>
          <h2>{state.team_count}</h2>
        </div>

        <div className="card">
          <small>Confirmed</small>
          <h2>
            {
              state.teams.filter(
                team => team.status === 'confirmed'
              ).length
            }
          </h2>
        </div>

        <div className="card">
          <small>Checked in</small>
          <h2>{checked}</h2>
        </div>

        <div className="card">
          <small>Not checked in</small>
          <h2>{state.team_count - checked}</h2>
        </div>
      </div>

      <div className="level-grid">
        {state.levels.map(level => (
          <div
            className="card"
            key={level.id}
          >
            <span className="badge">
              {level.status}
            </span>

            <h3>{level.name}</h3>
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
          onClick={() => setTab('Check-in')}
        >
          Open check-in →
        </button>
      </div>
    </>
  );
}


function Teams({ mode }: { mode: string }) {
  const {
    state,
    act,
    notify,
  } = useApp();

  const [search, setSearch] = useState('');
  const [attendance, setAttendance] = useState('All');
  const [status, setStatus] = useState('All');
  const [college, setCollege] = useState('');
  const [branch, setBranch] = useState('');
  const [selected, setSelected] =
    useState<string | null>(null);

  const team = state.teams.find(
    t => t.id === selected
  );

  const rows = state.teams.filter(team => {
    const matchesSearch =
      `${team.name} ${team.code}`
        .toLowerCase()
        .includes(search.toLowerCase());

    const matchesAttendance =
      attendance === 'All' ||
      (
        attendance === 'Checked in'
          ? !!team.checked_in_at
          : !team.checked_in_at
      );

    const matchesStatus =
      status === 'All' ||
      team.status === status;

    const matchesCollege =
      !college ||
      team.members.some(member =>
        member.college
          .toLowerCase()
          .includes(college.toLowerCase())
      );

    const matchesBranch =
      !branch ||
      team.members.some(member =>
        member.branch
          .toLowerCase()
          .includes(branch.toLowerCase())
      );

    return (
      matchesSearch &&
      matchesAttendance &&
      matchesStatus &&
      matchesCollege &&
      matchesBranch
    );
  });

  const scan = (token: string) => {
    const value = token.trim();

    const found = state.teams.find(
      team =>
        team.qr_token === value ||
        team.code === value
    );

    if (found) {
      setSelected(found.id);
    } else {
      notify(
        'No matching team pass. Check the token or Team ID.'
      );
    }
  };

  return (
    <>
      {mode === 'Check-in' && (
        <Scanner onScan={scan} />
      )}

      <div className="filters">
        <Field
          label="Search name / Team ID"
          value={search}
          onChange={event =>
            setSearch(event.target.value)
          }
        />

        <Select
          label="Check-in"
          options={[
            'All',
            'Checked in',
            'Not checked in',
          ]}
          value={attendance}
          onChange={event =>
            setAttendance(event.target.value)
          }
        />

        <Select
          label="Status"
          options={[
            'All',
            'confirmed',
            'disqualified',
          ]}
          value={status}
          onChange={event =>
            setStatus(event.target.value)
          }
        />

        <Field
          label="College"
          value={college}
          onChange={event =>
            setCollege(event.target.value)
          }
        />

        <Field
          label="Department"
          value={branch}
          onChange={event =>
            setBranch(event.target.value)
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
            {rows.map(team => (
              <tr key={team.id}>
                <td>{team.code}</td>

                <td>
                  <strong>{team.name}</strong>

                  <small>
                    {team.members[0]?.college}
                  </small>
                </td>

                <td>
                  {team.members.length} / 2
                </td>

                <td>
                  <span className="badge">
                    {team.status}
                  </span>
                </td>

                <td>
                  {team.checked_in_at
                    ? 'Checked in'
                    : 'Not yet'}
                </td>

                <td>
                  <button
                    className="text-button"
                    onClick={() =>
                      setSelected(team.id)
                    }
                  >
                    Review →
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {!rows.length && (
          <p className="empty">
            No matching teams.
          </p>
        )}
      </div>

      {team && (
        <Modal
          title={team.name}
          onClose={() =>
            setSelected(null)
          }
        >
          <p>
            {team.code} · {team.status}
          </p>

          {team.members.map((member, index) => (
            <div
              className="member-card"
              key={index}
            >
              <h3>
                {member.name} /{' '}
                {index === 0
                  ? 'Leader'
                  : 'Member'}
              </h3>

              <p>
                {member.email} · {member.phone}
                <br />
                {member.college} ·{' '}
                {member.college_id}
                <br />
                {member.branch} · Semester{' '}
                {member.semester}
              </p>
            </div>
          ))}

          <p>
            Registration:{' '}
            {new Date(
              team.created_at
            ).toLocaleString()}

            <br />

            Check-in:{' '}
            {team.checked_in_at
              ? new Date(
                  team.checked_in_at
                ).toLocaleString()
              : 'Not checked in'}
          </p>

          <div className="actions">
            {!team.checked_in_at &&
              team.status === 'confirmed' && (
                <AsyncButton
                  run={() =>
                    act(
                      'checkin',
                      { id: team.id }
                    )
                  }
                >
                  Verify and check in
                </AsyncButton>
              )}

            <AsyncButton
              className="button secondary"
              run={async () => {
                if (
                  confirm(
                    'Change team status?'
                  )
                ) {
                  await act(
                    'team_status',
                    {
                      id: team.id,
                      status:
                        team.status ===
                        'confirmed'
                          ? 'disqualified'
                          : 'confirmed',
                    }
                  );
                }
              }}
            >
              {team.status === 'confirmed'
                ? 'Disqualify'
                : 'Restore team'}
            </AsyncButton>
          </div>
        </Modal>
      )}
    </>
  );
}
