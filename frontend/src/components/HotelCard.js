export default function HotelCard({ hotel }) {
    return (
      <div className="inline-flex items-center px-4 bg-white border border-gray-200 rounded-lg shadow dark:bg-gray-800 dark:border-gray-700">
          <img className="self-start rounded-t-lg object-cover mt-7 mx-4" src={hotel.imageUrl} alt="Thumbnail" />
          <div className="p-5">
              <a href={hotel.listingUrl}>
                  <h5 className="mb-2 text-xl font-bold tracking-tight text-gray-900 dark:text-white">{hotel.name}</h5>
              </a>
              <p className="mb-3 font-normal text-gray-700 dark:text-gray-400">{hotel.description}</p>
              <a className="inline-flex items-center mt-4 px-3 py-2 text-sm font-medium text-center text-white bg-green-500 rounded-lg focus:ring-4 focus:outline-none focus:ring-blue-300 dark:bg-blue-600 dark:focus:ring-blue-800">
                  <span className="text-sm font-semibold">$</span>
                  <span className="text-m font-semibold">{hotel.price}</span>
              </a>
          </div>
      </div>
    );
  }
  