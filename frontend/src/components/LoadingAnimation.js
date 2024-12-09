  // TODO loading animation
  const LoadingAnimation = () => (
    <div className="flex items-center space-x-4 p-2 border-gray-200 rounded-lg response-message">
      <img src="/beebrain.jpg" alt="avatar" className="w-8 h-8 rounded-full self-start"/>
      <p className="text-gray-800">Loading...</p>
    </div>
  );

export default LoadingAnimation;