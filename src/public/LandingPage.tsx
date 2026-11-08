import { ArrowRight } from 'lucide-react'
import { PublicBrand } from './PublicBrand'

const workflow = [
  { number: '01', title: 'Connect locally', description: 'Pair the Windows connector with your MT5 terminal.' },
  { number: '02', title: 'Define your limits', description: 'Keep strategy settings and risk controls in view.' },
  { number: '03', title: 'Review each decision', description: 'Follow signals, execution states and trade history.' },
]

export function LandingPage() {
  return (
    <div className="public-site landing-page">
      <div className="landing-atmosphere">
        <header className="landing-header public-gutter">
          <PublicBrand />
          <nav aria-label="Public navigation" className="landing-nav"><a href="#workspace">Workspace</a><a href="#how-it-works">How it works</a></nav>
          <a className="public-button landing-signin" href="/login">Sign in</a>
        </header>

        <main>
          <section className="landing-hero public-gutter" id="workspace" aria-labelledby="landing-title">
            <div className="landing-hero-copy">
              <p className="public-kicker">YOUR PRIVATE TRADING WORKSPACE</p>
              <h1 id="landing-title">Your trading.<br /><span>A clearer view.</span></h1>
              <p className="landing-lead">Bring your MT5 accounts, trading decisions and trade history into one considered workspace.</p>
              <div className="landing-actions"><a className="public-button public-button--large" href="/login">Sign in to your workspace <ArrowRight aria-hidden="true" size={22} /></a><a className="public-text-link" href="#how-it-works">Explore the workflow</a></div>
              <p className="landing-access-note">Private owner access · No public sign-up</p>
            </div>
            <div className="landing-art">
              <img src="/images/candlestick-still-life.webp" alt="" fetchPriority="high" width="1672" height="941" />
              <div className="workspace-preview" aria-label="Illustrative workspace preview">
                <span className="public-kicker">WORKSPACE PREVIEW</span>
                <ul><li>No account connected</li><li>Connector offline</li><li>New entries paused</li></ul>
              </div>
              <span className="art-caption">Illustrative preview</span>
            </div>
          </section>

          <section className="workflow public-gutter" id="how-it-works" aria-label="How it works">
            {workflow.map((item) => <article className="workflow-item" key={item.number}><span className="workflow-number">{item.number} /</span><div><h2>{item.title}</h2><p>{item.description}</p></div></article>)}
          </section>
        </main>
      </div>

      <section className="landing-closing public-gutter"><h2>Your account. Your limits. Your call.</h2><a href="/login">Open your workspace <ArrowRight aria-hidden="true" size={24} /></a></section>
      <footer className="landing-footer public-gutter"><PublicBrand /><span>Private access</span><a href="/login">Sign in</a><small>Trading involves risk.</small></footer>
    </div>
  )
}
