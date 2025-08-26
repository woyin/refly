// Add custom styles for the editor and mention
export const mentionStyles = `
  .ProseMirror {
    outline: none;
    border: none;
    background: transparent;
    font-family: inherit;
    font-size: inherit;
    line-height: inherit;
    color: inherit;
    padding: 0;
    margin: 0;
    resize: none;
    min-height: 2.5rem;
    max-height: 12rem;
    overflow-y: auto;
  }
  
  .ProseMirror p {
    margin: 0;
  }
  
  .ProseMirror p.is-editor-empty:first-child::before {
    color: #adb5bd;
    content: attr(data-placeholder);
    float: left;
    height: 0;
    pointer-events: none;
  }
  
  .mention {
    background-color: #F5F5F5;
    border-radius: 16px;
    padding: 6px 12px;
    color: #000000;
    font-weight: 500;
    text-decoration: none;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 14px;
    line-height: 1.2;
    border: 1px solid #E0E0E0;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    transition: all 0.2s ease;
    margin-right:2px;
    margin-left:2px;
  }
  
  .mention::before {
    content: '';
    width: 16px;
    height: 16px;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' fill='none'%3E%3Ccircle cx='8' cy='8' r='8' fill='%2312B76A'/%3E%3Cpath d='M5 8L7 10L11 6' stroke='white' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
    background-size: contain;
    background-repeat: no-repeat;
    background-position: center;
    display: inline-block;
    flex-shrink: 0;
  }
  
  .mention:hover {
    background-color: #EEEEEE;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15);
  }

  /* Custom tippy styles to override default black border */
  .tippy-box {
    background-color: transparent !important;
    border: none !important;
    box-shadow: none !important;
  }
  
  .tippy-arrow {
    display: none !important;
  }
  
  .tippy-content {
    padding: 0 !important;
    background: transparent !important;
  }
`;
