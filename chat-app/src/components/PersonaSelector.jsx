import { useState, useRef, useEffect } from "react";
import "./PersonaSelector.css";

function PersonaSelector({ personas, selectedPersonaId, onPersonaChange, onEditPersonas }) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  const selectedPersona = personas.find(p => p.id === selectedPersonaId) || personas[0];

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handlePersonaSelect = (personaId) => {
    onPersonaChange(personaId);
    setIsOpen(false);
  };

  return (
    <div className="persona-selector" ref={dropdownRef}>
      <button
        className="persona-trigger"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
      >
        <span className="persona-name">{selectedPersona?.name}</span>
        <svg
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          className={`persona-arrow ${isOpen ? "open" : ""}`}
        >
          <path d="M3 4.5L6 7.5L9 4.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {isOpen && (
        <>
          <div className="persona-overlay" onClick={() => setIsOpen(false)} />
          <div className="persona-dropdown" role="listbox">
            <div className="persona-dropdown-header">
              <span className="persona-dropdown-title">Select Persona</span>
            </div>
            <div className="persona-list">
              {personas.map((persona) => (
                <button
                  key={persona.id}
                  className={`persona-option ${persona.id === selectedPersonaId ? "active" : ""}`}
                  onClick={() => handlePersonaSelect(persona.id)}
                  role="option"
                  aria-selected={persona.id === selectedPersonaId}
                >
                  <div className="persona-option-info">
                    <span className="persona-option-name">{persona.name}</span>
                    <span className="persona-option-desc">{persona.description}</span>
                  </div>
                </button>
              ))}
            </div>
            <div className="persona-dropdown-footer">
              <button
                className="persona-edit-btn"
                onClick={() => {
                  setIsOpen(false);
                  onEditPersonas();
                }}
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 14 14"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                >
                  <path d="M10.5 1.5l2 2-8 8H2.5v-2l8-8zM9 2.5l2 2" />
                </svg>
                Edit Personas
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default PersonaSelector;
