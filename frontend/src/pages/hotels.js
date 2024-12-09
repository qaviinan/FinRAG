import Head from 'next/head';
import { useEffect, useState } from 'react';
import HotelCard from '../components/HotelCard';

export default function Hotels() {
  const [hotels, setHotels] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [hotelsPerPage] = useState(10);
  const [filters, setFilters] = useState([]);

  // Function to fetch hotels
  const fetchHotels = (userInput) => {
    setLoading(true);
    // fetch(`API_ENDPOINT?query=${encodeURIComponent(userInput)}`)  // Replace API_ENDPOINT with your actual endpoint
    fetch("http://localhost:8001/chat", {
        headers: {
            'Content-Type': 'application/json'
        },
        method: 'POST',
        body: JSON.stringify({
            query: userInput
        })
    })
    .then(response => response.json())
    .then(data => {
    setHotels(data.listings.map(item => ({
        id: item.idStr,  // Assuming each item has a unique ID
        imageUrl: item.image_url,
        listingUrl: item.url,
        name: item.name,
        description: item.description,
        stars: item.stars,
        price: item.price
    })));
    setFilters(data.filters);
    setLoading(false);

    })
    .catch(error => {
    console.error('Error:', error);
    setLoading(false);
    });
  };

  // useEffect to handle the initial API call
  useEffect(() => {
    fetchHotels("firstcall");
  }, []);

  // Handle search input changes
  const handleInputChange = (e) => {
    setSearch(e.target.value);
  };

  // Handle form submission
  const handleSearch = (e) => {
    e.preventDefault();
    fetchHotels(search);
  };

  // Pagination logic
  const indexOfLastHotel = currentPage * hotelsPerPage;
  const indexOfFirstHotel = indexOfLastHotel - hotelsPerPage;
  const currentHotels = hotels.slice(indexOfFirstHotel, indexOfLastHotel);
  const paginate = pageNumber => setCurrentPage(pageNumber);

  return (
    <>
      <Head>
        <title>Hotels in Bangkok</title>
      </Head>
      <main className="p-5 bg-slate-100 flex justify-center items-center">
        <div className="w-3/4 sm:w-full md:w-full lg:w-3/4">
          <div className="w-full flex justify-center mb-1 pt-4">
            <form onSubmit={handleSearch} className="flex w-full max-w-lg items-center">
              <div className="flex-grow flex justify-center">
                <input
                  type="text"
                  placeholder="Search hotels..."
                  className="input border-1 text-gray-800 bg-slate-100 border-gray-400 w-3/4 text-sm"  // Adjust width as needed
                  value={search}
                  onChange={handleInputChange}
                />
                <button type="submit" className="btn btn-primary font-medium border-0 ml-1 bg-base-400 text-slate-100">Search</button>
              </div>   
            </form>
          </div>
          <div>
            {filters.length > 0 && (
                <div className='py-8 mt-0 flex justify-center'>
                    {filters.map((filter, index) => (
                        <span key={index} id={`badge-dismiss-${index}`} className="inline-flex items-center px-2 py-1 me-2 text-sm font-medium text-blue-800 bg-blue-100 rounded dark:bg-blue-900 dark:text-blue-300">
                            {filter}
                        </span>
                    ))}
                </div>
            )}
          </div>
          {loading ? (
            <div>Loading...</div>
          ) : (
            <div className="items-center bg-slate-100">
              {currentHotels.map(hotel => (
                <HotelCard key={hotel.id} hotel={hotel} />
              ))}
            </div>
          )}
          <div className="pagination">
            <button onClick={() => paginate(currentPage - 1)} disabled={currentPage === 1}>
              Previous
            </button>
            {Array.from({ length: Math.ceil(hotels.length / hotelsPerPage) }, (_, index) => (
              <button key={index + 1} onClick={() => paginate(index + 1)} className={index + 1 === currentPage ? 'active' : ''}>
                {index + 1}
              </button>
            ))}
            <button onClick={() => paginate(currentPage + 1)} disabled={currentPage === Math.ceil(hotels.length / hotelsPerPage)}>
              Next
            </button>
          </div>
        </div>
      </main>
    </>
  );
}
