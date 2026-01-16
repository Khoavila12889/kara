export const animationStyles = `
  @keyframes pulse {
    0%, 100% { transform: scale(1); }
    50% { transform: scale(1.2); }
  }

  @keyframes bounce {
    0%, 20%, 50%, 80%, 100% { transform: translateY(0); }
    40% { transform: translateY(-8px); }
    60% { transform: translateY(-4px); }
  }

  @keyframes fadeInOut {
    0%, 100% { opacity: 0.7; }
    50% { opacity: 1; }
  }

  .pulse-animation {
    animation: pulse 2s infinite;
  }

  .bounce-animation {
    animation: bounce 3s infinite;
  }

  .fade-animation {
    animation: fadeInOut 3s infinite;
  }

  .interactive-button {
    transition: all 0.2s ease;
  }

  .interactive-button:hover {
    transform: scale(1.15);
  }
`;