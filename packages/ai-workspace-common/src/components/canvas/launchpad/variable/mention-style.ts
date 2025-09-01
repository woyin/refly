// Add custom styles for the editor and mention
export const mentionStyles = `
  .ProseMirror {
    outline: none;
    border: none;
    background: transparent;
    font-family: inherit;
    font-size: inherit;
    line-height: inherit;
    color: var(--refly-text-0);
    padding: 0;
    margin: 0;
    resize: none;
    min-height: 2.5rem;
    max-height: 12rem;
    overflow-y: auto;
  }

  .ProseMirror p {
    margin: 0;
    padding: 0;
    line-height: 26px;
    font-size: 16px;
    color: var(--text-icon-refly-text-0, #1C1F23);
    font-family: "PingFang SC";
    font-style: normal;
    font-weight: 400;
  }

  /* Ensure text content is also vertically centered */
  .ProseMirror p > *:not(.mention) {
    display: inline-flex;
    align-items: center;
    line-height: 1;
  }
  
  .ProseMirror p.is-editor-empty:first-child::before {
    color: var(--refly-text-3);
    content: attr(data-placeholder);
    float: left;
    height: 0;
    pointer-events: none;
  }
  
  .mention {
    background-color: var(--refly-fill-default);
    border-radius: 4px;
    padding: 2px 4px 2px;
    border: 1px solid var(--refly-Card-Border);
    color: var(--text-icon-refly-text-0, #1C1F23);
    font-weight: 600;
    text-decoration: none;
    display: inline-flex;
    align-items: center;
    vertical-align: middle;
    font-size: 12px;
    line-height: 16px;
    font-family: "PingFang SC";
    font-style: normal;
    max-width: 200px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    transition: all 0.2s ease;
    position: relative;
    top: -1px;
  }
  
  .mention .mention-icon {
    width: 14px;
    height: 14px;
    display: inline-block;
    vertical-align: middle;
    margin-right: 2px;
    position: relative;
   
  }
  
  .mention .mention-icon svg {
    width: 14px;
    height: 14px;
    display: block;
  }
  
  .mention .mention-text {
    font-weight: 500;
    font-size: 12px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    min-width: 0;
    display: inline-block;
    vertical-align: middle;
    line-height: 1.2;
  }
  
  .mention:hover {
    background-color: var(--refly-fill-hover);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
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
