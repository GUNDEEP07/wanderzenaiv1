import React, { useEffect, useState } from "react"
import { useLocation, useNavigate } from "react-router-dom"

const API_URL = import.meta.env.VITE_API_URL

const STEPS = [
  { key: "pending",         label: "Packing the bags...",                        done: false },
  { key: "processing",      label: "Wandering the back streets just for you",   done: false },
  { key: "itinerary_ready", label: "Hidden gems found, tourist traps avoided",  done: false },
  { key: "pdf_ready",       label: "Rolling out your travel scroll",            done: false },
  { key: "email_sent",      label: "Your adventure is in your inbox",           done: false },
]

const STATUS_ORDER = ["pending", "processing", "itinerary_ready", "pdf_ready", "email_sent", "failed"]

export default function Confirmation() {
  const { state } = useLocation()
  const navigate = useNavigate()
  const [status, setStatus] = useState("pending")
  const [displayStatus, setDisplayStatus] = useState("pending")
  const [error, setError] = useState("")
  const lastStepTime = React.useRef(Date.now())
  const pendingStatus = React.useRef("pending")

  const destination = state?.destination || "your destination"
  const email = state?.email || "your inbox"
  const submissionId = state?.submissionId

  // Advance display status with minimum 2 second delay per step
  const advanceDisplay = (newStatus) => {
    if (newStatus === pendingStatus.current) return
    const now = Date.now()
    const elapsed = now - lastStepTime.current
    const minDelay = 2000

    const doAdvance = () => {
      pendingStatus.current = newStatus
      setDisplayStatus(newStatus)
      lastStepTime.current = Date.now()
    }

    if (elapsed >= minDelay) {
      doAdvance()
    } else {
      setTimeout(doAdvance, minDelay - elapsed)
    }
  }

  useEffect(() => {
    if (!submissionId) {
      navigate("/plan")
      return
    }

    const poll = async () => {
      try {
        const res = await fetch(`${API_URL}/itinerary/${submissionId}`)
        const data = await res.json()
        if (data.success && data.data?.status) {
          const newStatus = data.data.status
          setStatus(newStatus)
          advanceDisplay(newStatus)
          if (newStatus === "failed") {
            setError(data.data.error_message || "Something went wrong. Please try again.")
          }
        }
      } catch (e) {
        console.log("Poll error:", e)
      }
    }

    // Auto-advance display through early steps for visual feedback
    // even before API confirms — min 2s per step
    const visualSteps = ["pending", "processing", "itinerary_ready"]
    let visualIdx = 0
    const visualInterval = setInterval(() => {
      visualIdx++
      if (visualIdx < visualSteps.length) {
        advanceDisplay(visualSteps[visualIdx])
      } else {
        clearInterval(visualInterval)
      }
    }, 3000)

    // Poll API every 5 seconds
    poll()
    const pollInterval = setInterval(() => {
      if (status === "email_sent" || status === "failed") {
        clearInterval(pollInterval)
        clearInterval(visualInterval)
        return
      }
      poll()
    }, 5000)

    return () => {
      clearInterval(pollInterval)
      clearInterval(visualInterval)
    }
  }, [submissionId])

  const currentStep = STATUS_ORDER.indexOf(displayStatus)

  const steps = STEPS.map((step, i) => ({
    ...step,
    done: i < currentStep,
    active: STATUS_ORDER[currentStep] === step.key,
  }))

  return (
    <div style={{ minHeight: "100vh", background: "#faf7f2", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "2rem", fontFamily: "Source Serif 4, Georgia, serif" }}>
      <div style={{ maxWidth: "540px", width: "100%", textAlign: "center" }}>

        {displayStatus === "email_sent" ? (
          <>
            <div style={{ width: 64, height: 64, borderRadius: "50%", background: "#e8f0ea", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 2rem", fontSize: "1.75rem" }}>✓</div>
            <div style={{ fontSize: "0.7rem", letterSpacing: "0.25em", textTransform: "uppercase", color: "#4a7c59", marginBottom: "0.75rem" }}>Delivered</div>
            <h1 style={{ fontFamily: "Playfair Display, serif", fontSize: "2rem", color: "#1a2e20", marginBottom: "1rem", lineHeight: 1.2 }}>
              Your {destination} adventure begins now
            </h1>
            <p style={{ color: "#6a5e48", fontSize: "1rem", lineHeight: 1.8, marginBottom: "2rem" }}>
              Your slow travel guide to {destination} is waiting at <strong style={{ color: "#1a2e20" }}>{email}</strong>. Hidden cafes, secret trails and local gems — all yours. Check spam if it does not arrive within 5 minutes.
            </p>
            <button onClick={() => navigate("/plan")} style={{ background: "#1a2e20", color: "white", border: "none", padding: "0.85rem 2rem", borderRadius: "4px", fontFamily: "Source Serif 4, serif", fontSize: "0.95rem", cursor: "pointer", marginRight: "1rem" }}>
              Plan another trip
            </button>
            <button onClick={() => navigate("/pricing")} style={{ background: "none", border: "1px solid #c8b89a", padding: "0.85rem 2rem", borderRadius: "4px", fontFamily: "Source Serif 4, serif", fontSize: "0.95rem", color: "#6a5e48", cursor: "pointer" }}>
              See pricing
            </button>
          </>
        ) : displayStatus === "failed" ? (
          <>
            <div style={{ width: 64, height: 64, borderRadius: "50%", background: "#faecea", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 2rem", fontSize: "1.75rem" }}>✕</div>
            <h1 style={{ fontFamily: "Playfair Display, serif", fontSize: "2rem", color: "#1a2e20", marginBottom: "1rem" }}>Something went wrong</h1>
            <p style={{ color: "#6a5e48", fontSize: "1rem", lineHeight: 1.8, marginBottom: "2rem" }}>
              We could not generate your itinerary. Please try again — this is usually a temporary issue.
            </p>
            <button onClick={() => navigate("/plan")} style={{ background: "#1a2e20", color: "white", border: "none", padding: "0.85rem 2rem", borderRadius: "4px", fontFamily: "Source Serif 4, serif", fontSize: "0.95rem", cursor: "pointer" }}>
              Try again
            </button>
          </>
        ) : (
          <>
            <div style={{ width: 64, height: 64, borderRadius: "50%", background: "#e8f0ea", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 2rem" }}>
              <div style={{ width: 24, height: 24, borderRadius: "50%", border: "2px solid #4a7c59", borderTopColor: "transparent", animation: "spin 0.8s linear infinite" }} />
            </div>

            <div style={{ fontSize: "0.7rem", letterSpacing: "0.25em", textTransform: "uppercase", color: "#4a7c59", marginBottom: "0.75rem" }}>In progress</div>

            <h1 style={{ fontFamily: "Playfair Display, serif", fontSize: "2rem", color: "#1a2e20", marginBottom: "1rem", lineHeight: 1.2 }}>
              Finding the real {destination}, just for you
            </h1>

            <p style={{ color: "#6a5e48", fontSize: "1rem", lineHeight: 1.8, marginBottom: "2rem" }}>
              We are skipping the tourist trail and finding the {destination} locals actually love. Your personalised plan lands at <strong style={{ color: "#1a2e20" }}>{email}</strong> in just a few minutes.
            </p>

            <div style={{ background: "#e8f0ea", borderRadius: 6, padding: "1.25rem 1.5rem", marginBottom: "2rem", textAlign: "left" }}>
              {steps.map((step, i) => (
                <div key={step.key} style={{ display: "flex", alignItems: "center", gap: "0.75rem", padding: "0.4rem 0", fontSize: "0.9rem" }}>
                  <span style={{
                    width: 20, height: 20, borderRadius: "50%",
                    background: step.done ? "#4a7c59" : step.active ? "#e8f0ea" : "transparent",
                    border: step.done ? "none" : step.active ? "2px solid #4a7c59" : "1px solid #c8b89a",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: "0.7rem", color: "white", flexShrink: 0,
                    animation: step.active ? "pulse 1.5s ease-in-out infinite" : "none"
                  }}>
                    {step.done ? "✓" : ""}
                  </span>
                  <span style={{ color: step.done ? "#1a2e20" : step.active ? "#4a7c59" : "#9a8c78", fontWeight: step.active ? 600 : 400 }}>
                    {step.label}
                  </span>
                </div>
              ))}
            </div>

            <p style={{ fontSize: "0.8rem", color: "#9a8c78", fontStyle: "italic" }}>
              Check your spam folder if it does not arrive within 5 minutes.
            </p>
          </>
        )}
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }
      `}</style>
    </div>
  )
}
