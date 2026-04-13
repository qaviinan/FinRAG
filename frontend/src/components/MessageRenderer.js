import { ThumbsDown, ThumbsUp } from 'lucide-react';

// Feedback thumbs row — only rendered on assistant messages with a response_id
const FeedbackBar = ({ message, onFeedback }) => {
  if (!message.response_id || !onFeedback) return null;

  const liked = message.userRating === 'like';
  const disliked = message.userRating === 'dislike';

  return (
    <div className="flex items-center gap-2 mt-2 ml-12">
      <button
        title="Good response"
        onClick={() => onFeedback(message.response_id, 'like')}
        className={`p-1 rounded transition-colors ${
          liked
            ? 'text-green-500'
            : 'text-stone-400 hover:text-green-500'
        }`}
      >
        <ThumbsUp className="w-4 h-4" />
      </button>
      <button
        title="Bad response"
        onClick={() => onFeedback(message.response_id, 'dislike')}
        className={`p-1 rounded transition-colors ${
          disliked
            ? 'text-red-500'
            : 'text-stone-400 hover:text-red-500'
        }`}
      >
        <ThumbsDown className="w-4 h-4" />
      </button>
    </div>
  );
};

const MessageRenderer = ({ message, onFeedback }) => {
  switch (message.type) {
    case 'user':
      return (
        <div className="user-message bg-slate-600">
          <p className="text-gray-200">{message.content}</p>
        </div>
      );

    case 'text':
      return (
        <div>
          <div className="flex items-start space-x-4 p-2 border-gray-200 rounded-lg response-message">
            <img
              src="/beebrain.jpg"
              alt="avatar"
              className="w-8 h-8 rounded-full shrink-0 mt-1"
            />
            <p className="text-gray-800 whitespace-pre-wrap">{message.content}</p>
          </div>
          <FeedbackBar message={message} onFeedback={onFeedback} />
        </div>
      );

    case 'table':
      return (
        <div>
          <div className="flex items-start space-x-4 p-2 border-gray-200 rounded-lg response-message">
            <div className="shrink-0">
              <img
                src="/beebrain.jpg"
                alt="avatar"
                className="w-8 h-8 rounded-full"
              />
            </div>
            <div className="overflow-x-auto w-full text-gray-800">
              <table className="table-auto border-collapse border border-gray-300 my-4 text-sm">
                <thead>
                  <tr className="bg-gray-200">
                    {Object.keys(message.content[0]).map((key) => (
                      <th key={key} className="px-4 py-2 border border-gray-300">
                        {key}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {message.content.map((row, index) => (
                    <tr key={index} className={index % 2 === 0 ? 'bg-gray-100' : 'bg-white'}>
                      {Object.values(row).map((value, idx) => (
                        <td
                          key={idx}
                          className="px-4 py-2 border border-gray-300 text-center"
                        >
                          {value}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <FeedbackBar message={message} onFeedback={onFeedback} />
        </div>
      );

    case 'plot':
      return (
        <div>
          <img src={message.content} alt="Plot" className="rounded-lg" />
          <FeedbackBar message={message} onFeedback={onFeedback} />
        </div>
      );

    case 'rag':
      return (
        <div>
          <div className="flex items-start space-x-4 p-2 border border-yellow-200 rounded-lg bg-yellow-50">
            <div className="shrink-0">
              <img
                src="/beebrain.jpg"
                alt="rag"
                className="w-8 h-8 rounded-full"
              />
            </div>
            <div className="w-full">
              <div className="text-[11px] text-slate-500 mb-1">RAG suggestion</div>
              <div className="text-sm text-slate-800 whitespace-pre-wrap">{message.content}</div>
            </div>
          </div>
        </div>
      );

    default:
      return null;
  }
};

export default MessageRenderer;
