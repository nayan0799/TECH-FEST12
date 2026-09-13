'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  Menu,
  X,
  ArrowDown,
  ArrowRight,
  MapPin,
  Calendar,
  ArrowUpRight,
} from 'lucide-react';

import { useApp } from './provider';
import { Brand, Countdown, Reveal, Icon, Modal, Brain } from './ui';
import type { Level } from '@/lib/types';

export function Home() {
  const { state, loading, error } = useApp();

  const c = state.config;

  const [menu, setMenu] = useState(false);
  const [level, setLevel] = useState<Level | null>(null);
  const [now, setNow] = useState<number | null>(null);

  /*
   * Update browser title and countdown time
   */
  useEffect(() => {
    document.title = c.browser_title;

    const i = setInterval(() => {
      setNow(Date.now());
    }, 1000);

    setNow(Date.now());

    return () => clearInterval(i);
  }, [c.browser_title]);

  /*
   * Update favicon
   */
  useEffect(() => {
    if (!c.favicon) return;

    let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');

    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.head.appendChild(link);
    }

    link.href = c.favicon;
  }, [c.favicon]);

  /*
   * AUTOMATIC LOGIN REDIRECT
   *
   * If Supabase finds an existing session:
   *
   * Student -> /student/dashboard
   * Admin   -> /admin
   *
   * If there is no session, the public homepage remains visible.
   */
  useEffect(() => {
    if (loading || !state.profile) return;

    window.location.replace(
      state.profile.role === 'admin'
        ? '/admin'
        : '/student/dashboard'
    );
  }, [loading, state.profile]);

  /*
   * Registration status
   */
  const closed =
    !c.registration_open ||
    state.team_count >= c.capacity ||
    (now !== null &&
      (now < Date.parse(c.opens_at) ||
        now > Date.parse(c.deadline)));

  /*
   * Registration destination
   */
  const register = state.profile
    ? '/student/dashboard'
    : '/student/signup';

  /*
   * Announcements
   */
  const announcements = state.announcements.filter(
    (a) =>
      a.published &&
      a.audience === 'everyone' &&
      (!now || Date.parse(a.publish_at) <= now)
  );

  /*
   * Dynamic CSS variables
   */
  const css: Record<string, string> = {};

  Object.entries(c.colors).forEach(([key, value]) => {
    css['--' + key] = value;
  });

  css['--radius'] = c.radius + 'px';
  css['--heading-font'] = c.heading_font;
  css['--body-font'] = c.body_font;

  return (
    <div
      className={
        'public-site ' +
        (c.theme === 'light' ? 'light' : '') +
        ' hover-' +
        c.button_hover +
        ' style-' +
        c.button_style +
        ' size-' +
        c.button_size
      }
      style={css as React.CSSProperties}
    >
      {/* NAVBAR */}
      <nav className="topbar">
        <Brand />

        <div
          className={
            'navlinks ' + (menu ? 'is-open' : '')
          }
        >
          {c.nav
            .filter((n) => n.visible)
            .map((n) => (
              <a
                key={n.description}
                href={'#' + n.description}
                onClick={() => setMenu(false)}
              >
                {n.title}
              </a>
            ))}
        </div>

        <Link
          href="/student/login"
          className="login-link"
        >
          {state.profile ? 'Dashboard' : 'Login'}

          <ArrowUpRight size={16} />
        </Link>

        <button
          className="icon-button mobile"
          aria-label="Toggle menu"
          onClick={() => setMenu(!menu)}
        >
          {menu ? <X /> : <Menu />}
        </button>
      </nav>

      {/* ERROR */}
      {error && (
        <div className="site-alert">
          Live event data is unavailable. Please try again
          shortly.
        </div>
      )}

      <main>
        {/* HERO */}
        <section id="home" className="hero">
          <div className="hero-grid" />

          <div className="hero-copy">
            <div className="kicker">
              <span className="live-dot" />

              {c.college}

              <span className="kicker-line" />
            </div>

            <h1>
              {c.name.split(' ').map((word, index) => (
                <span
                  className={
                    index === 0
                      ? ''
                      : 'outline-word'
                  }
                  key={index}
                >
                  {word}{' '}
                </span>
              ))}
            </h1>

            <div className="tagline">
              {c.tagline}

              <span className="small-star">
                ✳
              </span>
            </div>

            <p className="hero-description">
              {c.description}
            </p>

            <div className="hero-actions">
              {closed ? (
                <span className="button disabled">
                  Registration closed
                </span>
              ) : (
                <Link
                  className="button"
                  href={register}
                >
                  {c.register_label}

                  <ArrowUpRight size={19} />
                </Link>
              )}

              <a
                href="#levels"
                className="text-button"
              >
                {c.explore_label}

                <ArrowRight size={17} />
              </a>
            </div>

            <div className="hero-meta">
              <span>
                <UsersIcon />
                2 minds per team
              </span>

              <span>
                <MapPin size={15} />
                {c.venue}
              </span>

              <span>
                <Calendar size={15} />

                {new Date(
                  c.starts_at
                ).toLocaleDateString('en-GB', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                  timeZone: c.timezone,
                })}
              </span>
            </div>
          </div>

          {/* HERO ART */}
          <div
            className="hero-art"
            aria-hidden="true"
          >
            {c.hero_image ? (
              <img
                className="custom-hero"
                src={c.hero_image}
                alt=""
              />
            ) : (
              <>
                <div className="orbit orbit-one" />
                <div className="orbit orbit-two" />
                <div className="orbit orbit-three" />

                <div className="neural-orb">
                  <svg
                    viewBox="0 0 400 400"
                    suppressHydrationWarning
                  >
                    <defs>
                      <radialGradient id="orbGlow">
                        <stop
                          offset="0"
                          stopColor="#fff"
                          stopOpacity=".19"
                        />

                        <stop
                          offset="1"
                          stopColor="#fff"
                          stopOpacity="0"
                        />
                      </radialGradient>
                    </defs>

                    <circle
                      cx="200"
                      cy="200"
                      r="190"
                      fill="url(#orbGlow)"
                    />

                    {Array.from(
                      { length: 15 },
                      (_, i) => (
                        <ellipse
                          key={'v' + i}
                          cx="200"
                          cy="200"
                          rx={Number((18 + i * 11).toFixed(6))}
                          ry="171"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth=".65"
                          transform={
                            'rotate(' +
                            i * 12 +
                            ' 200 200)'
                          }
                          opacity={
                            .15 + i * .035
                          }
                        />
                      )
                    )}

                    {Array.from(
                      { length: 11 },
                      (_, i) => (
                        <ellipse
                          key={'h' + i}
                          cx="200"
                          cy={Number((80 + i * 24).toFixed(6))}
                          rx={Number(
                            Math.sqrt(
                              Math.max(
                                0,
                                171 ** 2 -
                                  (120 - i * 24) ** 2
                              )
                            ).toFixed(6)
                          )}
                          ry="28"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth=".8"
                          opacity=".4"
                        />
                      )
                    )}

                    {Array.from(
                      { length: 24 },
                      (_, i) => {
                        const a = i * 2.4;
                        const r = 60 + (i % 5) * 23;

                        const x = Number(
                          (200 + Math.cos(a) * r).toFixed(6)
                        );

                        const y = Number(
                          (200 + Math.sin(a) * r).toFixed(6)
                        );

                        return (
                          <g key={'n' + i}>
                            <line
                              x1="200"
                              y1="200"
                              x2={x}
                              y2={y}
                              stroke="currentColor"
                              opacity=".12"
                            />

                            <circle
                              cx={x}
                              cy={y}
                              r={i % 3 === 0 ? 3 : 1.5}
                              fill="currentColor"
                            />
                          </g>
                        );
                      }
                    )}
                  </svg>
                </div>

                <div className="floating-label label-top">
                  <span>
                    01 / LOGIC
                  </span>
                  <i />
                </div>

                <div className="floating-label label-bottom">
                  <span>
                    02 / INSTINCT
                  </span>
                  <i />
                </div>

                <div className="art-cross cross-one">
                  +
                </div>

                <div className="art-cross cross-two">
                  +
                </div>

                <small className="art-caption">
                  UNLOCK YOUR NEXT LEVEL.
                </small>
              </>
            )}
          </div>

          {/* COUNTDOWN */}
          <div className="countdown-strip">
            <div>
              <small className="eyebrow">
                THE CLOCK IS TICKING
              </small>

              <span>
                Your next challenge starts in
              </span>
            </div>

            <Countdown />

            <a
              href="#about"
              className="scroll-cue"
              aria-label="Scroll to about"
            >
              <ArrowDown size={20} />
            </a>
          </div>
        </section>

        {/* MARQUEE */}
        <div
          className="marquee"
          aria-hidden="true"
        >
          <div>
            {Array.from(
              { length: 6 },
              (_, i) => (
                <span key={i}>
                  THINK BEYOND <i>✳</i>{' '}
                  PLAY TOGETHER <i>✳</i>{' '}
                  CONQUER MORE <i>✳</i>
                </span>
              )
            )}
          </div>
        </div>

        {/* ABOUT */}
        <section
          id="about"
          className="section about-section"
        >
          <Reveal>
            <div className="section-index">
              01 / THE IDEA
            </div>

            <h2>{c.about_title}</h2>
          </Reveal>

          <Reveal>
            <p className="large-copy">
              {c.about}
            </p>

            <div className="objectives">
              {c.objectives
                .filter((o) => o.visible)
                .map((o) => (
                  <div key={o.title}>
                    <span>↗</span>
                    {o.title}
                  </div>
                ))}
            </div>

            <div className="mini-stats">
              <div>
                <strong>02</strong>
                <span>
                  MINDS / TEAM
                </span>
              </div>

              <div>
                <strong>03</strong>
                <span>
                  LEVELS TO CONQUER
                </span>
              </div>

              <div>
                <strong>01</strong>
                <span>
                  EPIC EXPERIENCE
                </span>
              </div>
            </div>
          </Reveal>
        </section>

        {/* BENEFITS */}
        <section className="section">
          <Reveal className="section-heading">
            <div>
              <div className="section-index">
                02 / WHY SHOW UP
              </div>

              <h2>
                Bring your curiosity.
                <br />

                <span className="muted">
                  Leave with a story.
                </span>
              </h2>
            </div>

            <p>
              More than a competition.
              <br />
              A playground for your mind.
            </p>
          </Reveal>

          <div className="benefit-grid">
            {c.benefits
              .filter((b) => b.visible)
              .map((b, i) => (
                <Reveal
                  className="benefit card"
                  key={i}
                >
                  <div className="card-top">
                    <Icon name={b.icon} />

                    <small>
                      0{i + 1}
                    </small>
                  </div>

                  <h3>{b.title}</h3>

                  <p>
                    {b.description}
                  </p>
                </Reveal>
              ))}
          </div>
        </section>

        {/* LEVELS */}
        <section
          id="levels"
          className="section levels-section"
        >
          <Reveal className="section-heading">
            <div>
              <div className="section-index">
                03 / THE CHALLENGE
              </div>

              <h2>
                Three levels.
                <br />
                Zero autopilot.
              </h2>
            </div>

            <p>
              Start sharp. Think deeper.
              <br />
              Finish as a mind master.
            </p>
          </Reveal>

          <div className="level-grid">
            {state.levels
              .filter((l) => l.visible)
              .map((l) => (
                <Reveal
                  className="level-card"
                  key={l.id}
                >
                  <div className="level-card-top">
                    <span className="badge">
                      LEVEL 0{l.id}
                    </span>

                    <span className="difficulty">
                      {l.difficulty}
                    </span>
                  </div>

                  <div
                    className={
                      'level-symbol symbol-' +
                      l.id
                    }
                  >
                    {l.id === 1 ? (
                      <div className="puzzle-symbol">
                        {Array.from(
                          { length: 9 },
                          (_, i) => (
                            <i key={i} />
                          )
                        )}
                      </div>
                    ) : l.id === 2 ? (
                      <div className="logic-symbol">
                        <i />
                        <i />
                        <i />
                      </div>
                    ) : (
                      <div className="master-symbol">
                        ✳
                      </div>
                    )}
                  </div>

                  <h3>{l.name}</h3>

                  <p>{l.short}</p>

                  <div className="level-facts">
                    <span>
                      {l.minutes} MINUTES
                    </span>

                    <span>
                      {l.maximum} POINTS
                    </span>
                  </div>

                  <button
                    className="level-detail"
                    onClick={() =>
                      setLevel(l)
                    }
                  >
                    Explore level
                    <ArrowUpRight size={18} />
                  </button>
                </Reveal>
              ))}
          </div>
        </section>

        {/* GAME PLAN */}
        <section className="section">
          <Reveal>
            <div className="section-index">
              04 / YOUR GAME PLAN
            </div>

            <h2>
              From sign-up
              <br />
              to standing out.
            </h2>
          </Reveal>

          <div className="steps">
            {c.steps
              .filter((s) => s.visible)
              .map((s, i) => (
                <Reveal
                  className="step"
                  key={i}
                >
                  <span>
                    {String(i + 1).padStart(
                      2,
                      '0'
                    )}
                  </span>

                  <div>
                    <h3>{s.title}</h3>

                    <p>
                      {s.description}
                    </p>
                  </div>
                </Reveal>
              ))}
          </div>
        </section>

        {/* RULES */}
        <section
          id="rules"
          className="section rules-section"
        >
          <Reveal>
            <div className="section-index">
              05 / FAIR PLAY
            </div>

            <h2>
              A few rules.
              <br />

              <span className="muted">
                A better game.
              </span>
            </h2>

            <p>
              Bring your best. Keep it fair.
            </p>
          </Reveal>

          <Reveal>
            <div className="accordion">
              {c.rules
                .filter((r) => r.visible)
                .map((r, i) => (
                  <details key={i}>
                    <summary>
                      <span>
                        {String(i + 1).padStart(
                          2,
                          '0'
                        )}
                      </span>

                      {r.title}

                      <b>+</b>
                    </summary>

                    <p>
                      {r.description}
                    </p>
                  </details>
                ))}
            </div>
          </Reveal>
        </section>

        {/* REGISTRATION CTA */}
        <section className="section">
          <Reveal className="registration-cta">
            {c.banner && (
              <img
                src={c.banner}
                className="cta-image"
                alt=""
              />
            )}

            <div className="section-index">
              YOUR NEXT MOVE
            </div>

            <h2>
              GOT THE
              <br />

              <span className="outline-word">
                MIND RIZZ?
              </span>
            </h2>

            <p>
              Find your teammate. Trust your
              instincts. Make your move.
            </p>

            {closed ? (
              <span className="button disabled">
                Registration closed
              </span>
            ) : (
              <Link
                href={register}
                className="button"
              >
                {c.register_label}

                <ArrowUpRight size={20} />
              </Link>
            )}

            <small>
              {Math.max(
                0,
                c.capacity -
                  state.team_count
              )}{' '}
              team spots available · Exactly
              2 members · Offline event
            </small>
          </Reveal>
        </section>

        {/* ANNOUNCEMENTS */}
        <section className="section announcements">
          <Reveal className="section-heading">
            <div>
              <div className="section-index">
                06 / STAY IN THE LOOP
              </div>

              <h2>
                The latest word.
              </h2>
            </div>

            <span className="badge">
              EVENT UPDATES
            </span>
          </Reveal>

          {announcements.length ? (
            announcements.map((a) => (
              <Reveal
                key={a.id}
                className="announcement"
              >
                <time>
                  {new Date(
                    a.publish_at
                  ).toLocaleDateString(
                    'en-GB'
                  )}
                </time>

                <div>
                  <h3>{a.title}</h3>

                  <p>{a.message}</p>
                </div>

                <ArrowUpRight />
              </Reveal>
            ))
          ) : (
            <p className="empty">
              No announcements yet. Your next
              update will appear here.
            </p>
          )}
        </section>
      </main>

      {/* FOOTER */}
      <footer>
        <div>
          <Brand />

          <p>{c.tagline}</p>
        </div>

        <div>
          <span>{c.college}</span>

          <small>
            © {c.edition} {c.name}. All rights
            reserved.
          </small>
        </div>

        <div className="footer-links">
          <a href="/privacy">
            Privacy
          </a>

          <a href="/terms">
            Terms
          </a>
        </div>

        <a
          href="#home"
          className="text-button"
        >
          Back to top
          <ArrowUpRight size={18} />
        </a>
      </footer>

      {/* LOADING */}
      {loading && (
        <span
          className="loading-dot"
          aria-label="Loading event"
        />
      )}

      {/* LEVEL MODAL */}
      {level && (
        <Modal
          title={level.name}
          onClose={() => setLevel(null)}
        >
          <p>{level.description}</p>

          <div className="level-facts">
            <span>
              {level.minutes} minutes
            </span>

            <span>
              {level.maximum} points
            </span>

            <span>
              {level.difficulty}
            </span>
          </div>

          <h3>Instructions</h3>

          <p className="preline">
            {level.instructions}
          </p>

          <h3>Rules</h3>

          <p>{level.rules}</p>
        </Modal>
      )}
    </div>
  );
}

/*
 * Small team icon
 */
function UsersIcon() {
  return <Brain size={15} />;
}