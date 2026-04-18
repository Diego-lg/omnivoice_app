import { useState } from "react";
import { PREMADE_PERSONAS, createCustomPersona, duplicatePersona } from "../data/personas";
import "./PersonaEditor.css";

function PersonaEditor({ personas, selectedPersonaId, onPersonaChange, onSave, onClose }) {
  const [localPersonas, setLocalPersonas] = useState(personas);
  const [editingId, setEditingId] = useState(null);

  const allPersonas = [...PREMADE_PERSONAS, ...localPersonas.filter(p => !p.isDefault)];

  const handlePersonaChange = (field, value) => {
    setLocalPersonas(prev =>
      prev.map(p => (p.id === editingId ? { ...p, [field]: value } : p))
    );
  };

  const handleAddPersona = () => {
    const newPersona = createCustomPersona();
    setLocalPersonas(prev => [...prev, newPersona]);
    setEditingId(newPersona.id);
  };

  const handleDuplicatePersona = (persona) => {
    const duplicated = duplicatePersona(persona);
    setLocalPersonas(prev => [...prev, duplicated]);
    setEditingId(duplicated.id);
  };

  const handleDeletePersona = (personaId) => {
    setLocalPersonas(prev => prev.filter(p => p.id !== personaId));
    if (editingId === personaId) {
      setEditingId(null);
    }
    if (selectedPersonaId === personaId) {
      onPersonaChange(PREMADE_PERSONAS[0].id);
    }
  };

  const handleSave = () => {
    onSave(localPersonas);
    onClose();
  };

  const handleEditClick = (personaId) => {
    setEditingId(personaId);
  };

  const editingPersona = localPersonas.find(p => p.id === editingId);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="persona-editor-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">Persona Editor</h2>
          <button className="modal-close" onClick={onClose} aria-label="Close">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M4 4L16 16M16 4L4 16" />
            </svg>
          </button>
        </div>

        <div className="persona-editor-body">
          <div className="persona-list-panel">
            <div className="persona-list-header">
              <span className="persona-list-title">All Personas</span>
              <button className="btn-add-persona" onClick={handleAddPersona}>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M7 2v10M2 7h10" strokeLinecap="round" />
                </svg>
                Add New
              </button>
            </div>
            <div className="persona-list">
              {allPersonas.map((persona) => (
                <div
                  key={persona.id}
                  className={`persona-list-item ${editingId === persona.id ? "active" : ""} ${persona.isDefault ? "premade" : ""}`}
                >
                  <button
                    className="persona-list-btn"
                    onClick={() => handleEditClick(persona.id)}
                  >
                    <div className="persona-item-info">
                      <span className="persona-item-name">
                        {persona.name}
                        {persona.isDefault && <span className="premade-badge">Default</span>}
                      </span>
                      <span className="persona-item-desc">{persona.description}</span>
                    </div>
                  </button>
                  {selectedPersonaId === persona.id && (
                    <span className="active-indicator">Active</span>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="persona-edit-panel">
            {editingPersona ? (
              <>
                <div className="persona-edit-header">
                  <h3 className="persona-edit-title">
                    {editingPersona.isDefault ? "View Persona" : "Edit Persona"}
                  </h3>
                  {editingPersona.isDefault && (
                    <span className="view-only-badge">View Only</span>
                  )}
                </div>

                <div className="persona-edit-form">
                  <div className="form-group">
                    <label className="form-label">Name</label>
                    <input
                      type="text"
                      className="form-input"
                      value={editingPersona.name}
                      onChange={(e) => handlePersonaChange("name", e.target.value)}
                      disabled={editingPersona.isDefault}
                      placeholder="Persona name"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Description</label>
                    <input
                      type="text"
                      className="form-input"
                      value={editingPersona.description}
                      onChange={(e) => handlePersonaChange("description", e.target.value)}
                      disabled={editingPersona.isDefault}
                      placeholder="Brief description"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">System Prompt</label>
                    <textarea
                      className="form-textarea"
                      value={editingPersona.systemPrompt}
                      onChange={(e) => handlePersonaChange("systemPrompt", e.target.value)}
                      disabled={editingPersona.isDefault}
                      placeholder="Enter the system prompt that defines this persona's behavior..."
                      rows={8}
                    />
                    <p className="form-hint">
                      This prompt is sent as a system message to define the AI's personality and behavior.
                    </p>
                  </div>
                </div>

                {!editingPersona.isDefault && (
                  <div className="persona-edit-actions">
                    <button
                      className="btn btn-secondary"
                      onClick={() => handleDeletePersona(editingPersona.id)}
                    >
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <path d="M2 4h10M5 4V2h4v2M6 7v5M8 7v5M3 4l1 10h6l1-10" />
                      </svg>
                      Delete
                    </button>
                    <button
                      className="btn btn-secondary"
                      onClick={() => handleDuplicatePersona(editingPersona)}
                    >
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <rect x="4" y="4" width="8" height="8" rx="1" />
                        <path d="M2 10V3a1 1 0 011-1h7" />
                      </svg>
                      Duplicate
                    </button>
                  </div>
                )}
              </>
            ) : (
              <div className="persona-edit-empty">
                <p>Select a persona to view or edit</p>
              </div>
            )}
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={handleSave}>
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}

export default PersonaEditor;
