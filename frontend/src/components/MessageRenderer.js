 // Helper component to render different types of messages
 const MessageRenderer = ({ message }) => {
    switch(message.type) {
      case 'user':
        return (
          <div className="user-message bg-slate-600">
            <p className="text-gray-200">{message.content}</p>
          </div>
        );
      case 'text':
        return (
          <div className="flex items-center space-x-4 p-2 border-gray-200 rounded-lg response-message">
            <img src="/beebrain.jpg" alt="avatar" className="w-8 h-8 rounded-full self-start"/>
            <p className="text-gray-800">{message.content}</p>
          </div>
        );
      case 'table':
        return (
          <div className="flex items-center space-x-4 p-2 border-gray-200 rounded-lg response-message">
            <div className="inline-block top-store self-start">
              <img src="/beebrain.jpg" alt="avatar" className="w-8 h-8 rounded-full"/>
            </div>
            <div className="overflow-x-auto w-full text-gray-800">
              <table className="table-auto border-collapse border border-gray-300 my-4">
                <thead>
                  <tr className="bg-gray-200">
                    {Object.keys(message.content[0]).map(key => (
                      <th key={key} className="px-4 py-2 border border-gray-300">{key}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {message.content.map((row, index) => (
                    <tr key={index} className={index % 2 === 0 ? 'bg-gray-100' : 'bg-white'}>
                      {Object.values(row).map((value, idx) => (
                        <td key={idx} className="px-4 py-2 border border-gray-300 text-center">{value}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      case 'plot':
        return <img src={message.content} alt="Plot" />;
      default:
        return null;
    }
  };

export default MessageRenderer;