import React from "react"
import { useNavigate, useLocation } from "react-router-dom"
import "./Pricing.css"

const SINGLE_LINK = import.meta.env.VITE_STRIPE_SINGLE_PLAN_LINK
const WANDERER_LINK = import.meta.env.VITE_STRIPE_WANDERER_LINK

const PLANS = [
  {
    name: "Explorer",
    price: "Free",
    period: "1 itinerary per month",
    description: "Perfect for occasional travellers",
    features: [
      "Full day-by-day plan",
      "Hidden gems every day",
      "Local food picks",
      "Insider tips",
      "PDF download",
      "Email delivery",
    ],
    cta: "Get started free",
    link: null,
    featured: false,
  },
  {
    name: "Wanderer",
    price: "$9",
    period: "per month",
    description: "For passionate slow travellers",
    features: [
      "Everything in Free",
      "5 itineraries per month",
      "Longer detailed plans",
      "Priority generation",
      "Accommodation deep-dives",
      "Cancel anytime",
    ],
    cta: "Start Wanderer",
    link: WANDERER_LINK,
    featured: true,
  },
  {
    name: "Single Plan",
    price: "$7",
    period: "one-time",
    description: "Just one trip, no commitment",
    features: [
      "Everything in Free",
      "1 premium itinerary",
      "No subscription",
      "Pay once, keep forever",
    ],
    cta: "Buy one plan",
    link: SINGLE_LINK,
    featured: false,
  },
]

const FAQS = [
  { q: "How long does it take?", a: "Your itinerary is generated and emailed within 2-3 minutes of submitting the form." },
  { q: "What format is the itinerary?", a: "A beautifully designed PDF you can download, print or save to your phone." },
  { q: "Can I request any destination?", a: "Yes — any city, region or country in the world. The more specific you are, the better the plan." },
  { q: "What makes this different?", a: "We avoid tourist traps by design. Every plan includes hidden gems, local eats and off-the-beaten-path stays." },
  { q: "Can I cancel my subscription?", a: "Yes, anytime. No questions asked. You keep all itineraries you have already generated." },
  { q: "Do you store my payment details?", a: "No — payments are handled entirely by Stripe. We never see your card details." },
]

export default function Pricing() {
  const navigate = useNavigate()
  const location = useLocation()
  const reason = location.state?.reason

  const handleCta = (plan) => {
    if (!plan.link) {
      navigate("/plan")
      return
    }
    window.location.href = plan.link
  }

  return (
    <div className="pricing-page">
      <nav className="pricing-nav">
        <button className="pricing-back" onClick={() => navigate("/")}>← WanderZenAI</button>
      </nav>

      <div className="pricing-inner">
        {reason === "free_limit" && (
          <div className="pricing-notice">
            You have used your free itinerary this month. Upgrade to continue planning.
          </div>
        )}

        <div className="pricing-header">
          <div className="pricing-eyebrow">Pricing</div>
          <h1 className="pricing-title">Simple, honest pricing.</h1>
          <p className="pricing-sub">No hidden fees. Cancel anytime. Your itinerary PDF is yours to keep forever.</p>
        </div>

        <div className="pricing-grid">
          {PLANS.map(plan => (
            <div key={plan.name} className={"pricing-card" + (plan.featured ? " featured" : "")}>
              {plan.featured && <div className="pricing-badge">Most popular</div>}
              <div className="pricing-plan-name">{plan.name}</div>
              <div className="pricing-plan-price">
                {plan.price}
                {plan.period && <span className="pricing-plan-period"> / {plan.period}</span>}
              </div>
              <div className="pricing-plan-desc">{plan.description}</div>
              <ul className="pricing-features">
                {plan.features.map(f => (
                  <li key={f}><span className="pricing-check">→</span>{f}</li>
                ))}
              </ul>
              <button
                className={"pricing-cta" + (plan.featured ? " pricing-cta-featured" : "")}
                onClick={() => handleCta(plan)}
              >
                {plan.cta}
              </button>
            </div>
          ))}
        </div>

        <div className="pricing-faq">
          <h2 className="pricing-faq-title">Common questions</h2>
          <div className="pricing-faq-grid">
            {FAQS.map(faq => (
              <div key={faq.q} className="pricing-faq-item">
                <div className="pricing-faq-q">{faq.q}</div>
                <div className="pricing-faq-a">{faq.a}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="pricing-footer">
          <p>Questions? Email us at <a href="mailto:travel@wanderzenai.com">travel@wanderzenai.com</a></p>
        </div>
      </div>
    </div>
  )
}
