/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
// import { GoogleGenAI } from "@google/genai"; // Keep commented as per original if API key not always present

interface BookData {
    id: string;
    title: string;
    author: string;
    categories: string[];
    coverClass: string;
    summary?: string; // Optional: for fetched summaries
}

interface FriendActivity {
    id: string;
    friendName: string;
    friendInitial: string;
    action: 'read' | 'reviewed' | 'bookmarked' | 'added to wishlist';
    bookTitle: string;
    reviewText?: string; 
    rating?: number;     // e.g., 0-5
    timestamp: string; 
}

const placeholderFriendActivities: FriendActivity[] = [
    { id: 'fa1', friendName: 'Alex Parker', friendInitial: 'A', action: 'read', bookTitle: 'Thorn and Roses', reviewText: "Absolutely captivating! Couldn't put it down.", rating: 5, timestamp: '30m ago' },
    { id: 'fa2', friendName: 'Maria Garcia', friendInitial: 'M', action: 'reviewed', bookTitle: 'Mist and Fury', reviewText: "A rollercoaster of emotions. The character development is amazing.", rating: 4, timestamp: '2h ago' },
    { id: 'fa3', friendName: 'Sam Kim', friendInitial: 'S', action: 'bookmarked', bookTitle: 'Echoes of Time', timestamp: 'Yesterday' },
    { id: 'fa4', friendName: 'Chloe Bell', friendInitial: 'C', action: 'added to wishlist', bookTitle: 'The Silent Star', timestamp: '3d ago' },
    { id: 'fa5', friendName: 'David Lee', friendInitial: 'D', action: 'read', bookTitle: 'Digital Realms', reviewText: "Mind-bending concepts and a thrilling plot. A must-read for sci-fi fans!", rating: 5, timestamp: '1w ago' },
];


document.addEventListener('DOMContentLoaded', () => {
    const views = {
        mainApp: document.getElementById('mainAppView'),
        bookDetail: document.getElementById('bookDetailView'),
        scrollFeed: document.getElementById('scrollFeedView'),
        bookmarks: document.getElementById('bookmarksView'),
        friendFeed: document.getElementById('friendFeedView'),
    };

    const categoryItems = document.querySelectorAll('.category-item');
    const domBookCards = document.querySelectorAll('.book-card'); 
    const searchInput = document.getElementById('searchInput') as HTMLInputElement;
    const searchButton = document.getElementById('searchButton');
    const noResultsMessage = document.getElementById('noResultsMessage');
    const noBookmarksMessage = document.getElementById('noBookmarksMessage');
    const bookmarkedBookList = document.getElementById('bookmarkedBookList');
    
    // Friend Feed Elements
    const friendActivityList = document.getElementById('friendActivityList');
    const noFriendActivityMessage = document.getElementById('noFriendActivityMessage');


    // Detail View Elements
    const backButton = document.getElementById('backButton');
    const bookDetailCover = document.getElementById('bookDetailCover');
    const bookDetailTitle = document.getElementById('bookDetailTitle');
    const bookDetailAuthor = document.getElementById('bookDetailAuthor');
    const bookDetailSummary = document.getElementById('bookDetailSummary');
    const bookDetailCategories = document.getElementById('bookDetailCategories');
    const bookmarkButton = document.getElementById('bookmarkButton');
    const bookmarkIcon = bookmarkButton?.querySelector('.bookmark-icon') as HTMLElement;
    const bookmarkText = bookmarkButton?.querySelector('.bookmark-text') as HTMLElement;

    // Navigation Buttons
    const navHomeButton = document.getElementById('navFeedButton'); 
    const navDiscoverButton = document.getElementById('navScrollButton'); 
    const navFriendFeedButton = document.getElementById('navFriendFeedButton');
    const navBookmarksButton = document.getElementById('navBookmarksButton');
    const navButtons = [navHomeButton, navDiscoverButton, navFriendFeedButton, navBookmarksButton];

    let currentFilter = 'All';
    let currentSearchTerm = '';
    let currentBookData: BookData | null = null;
    const bookmarkedBooks = new Set<string>();
    let allBooks: BookData[] = [];
    
    let activeViewId: keyof typeof views | null = null;
    const viewHistory: (keyof typeof views)[] = [];


    function initBooksData() {
        allBooks = [];
        domBookCards.forEach((card, index) => {
            const bookElement = card as HTMLElement;
            const titleElem = bookElement.querySelector('.book-title');
            const authorElem = bookElement.querySelector('.book-author');

            if (!titleElem || !authorElem) return;

            const title = titleElem.textContent?.trim() || 'Unknown Title';
            const author = authorElem.textContent?.trim() || 'Unknown Author';
            const categories = (bookElement.dataset.category || '').split(',').map(c => c.trim()).filter(c => c);
            const coverClass = bookElement.dataset.coverClass || '';
            const id = `book-${index}`; 

            allBooks.push({ id, title, author, categories, coverClass });
            bookElement.dataset.bookId = id; 
        });
    }


    function setActiveNavButton(activeButtonId: string) {
        navButtons.forEach(button => {
            if (button) {
                if (button.id === activeButtonId) {
                    button.classList.add('active');
                    button.setAttribute('aria-current', 'page');
                } else {
                    button.classList.remove('active');
                    button.removeAttribute('aria-current');
                }
            }
        });
    }
    
    function showView(viewId: keyof typeof views, isBackNavigation: boolean = false) {
        const isActuallySwitchingView = activeViewId !== viewId;

        if (activeViewId === 'bookDetail' && isActuallySwitchingView) {
            currentBookData = null; // Clear book data when navigating away from detail view
        }

        if (activeViewId && isActuallySwitchingView && !isBackNavigation) {
            viewHistory.push(activeViewId);
            if (viewHistory.length > 20) { // Cap history size
                viewHistory.shift();
            }
        }
        
        activeViewId = viewId;

        for (const key in views) {
            const viewElement = views[key as keyof typeof views];
            if (viewElement) {
                if (key === viewId) {
                    viewElement.classList.remove('hidden');
                } else {
                    viewElement.classList.add('hidden');
                }
            }
        }
        window.scrollTo(0, 0); 

        if (viewId === 'mainApp') setActiveNavButton('navFeedButton');
        else if (viewId === 'scrollFeed') setActiveNavButton('navScrollButton');
        else if (viewId === 'friendFeed') setActiveNavButton('navFriendFeedButton');
        else if (viewId === 'bookmarks') setActiveNavButton('navBookmarksButton');
        else if (viewId === 'bookDetail') {
            setActiveNavButton(''); // No nav button is active when in detail view
        } else {
             setActiveNavButton(''); 
        }

        if (viewId === 'scrollFeed') renderScrollFeed();
        if (viewId === 'bookmarks') renderBookmarks();
        if (viewId === 'friendFeed') renderFriendFeed();
        if (viewId === 'mainApp') filterAndDisplayBooks();
    }

    function filterAndDisplayBooks() {
        if (activeViewId !== 'mainApp' || !views.mainApp) return;

        let visibleBooksCount = 0;
        allBooks.forEach(book => {
            const cardElement = document.querySelector(`.book-card[data-book-id='${book.id}']`) as HTMLElement | null;
            if (!cardElement) return;

            const matchesCategory = currentFilter === 'All' || book.categories.includes(currentFilter);
            const searchTerm = currentSearchTerm.toLowerCase();
            const matchesSearch = searchTerm === '' || book.title.toLowerCase().includes(searchTerm) || book.author.toLowerCase().includes(searchTerm);

            if (matchesCategory && matchesSearch) {
                cardElement.classList.remove('hidden');
                visibleBooksCount++;
            } else {
                cardElement.classList.add('hidden');
            }
        });

        if (noResultsMessage) {
            noResultsMessage.style.display = visibleBooksCount === 0 ? 'block' : 'none';
        }
    }

    categoryItems.forEach(item => {
        item.addEventListener('click', () => {
            categoryItems.forEach(i => i.classList.remove('active'));
            item.classList.add('active');
            currentFilter = (item as HTMLElement).dataset.filter || 'All';
            filterAndDisplayBooks();
        });
        item.addEventListener('keydown', (event) => {
            if ((event as KeyboardEvent).key === 'Enter' || (event as KeyboardEvent).key === ' ') {
                (item as HTMLElement).click();
            }
        });
    });

    if (searchInput) {
        searchInput.addEventListener('input', () => {
            currentSearchTerm = searchInput.value;
            filterAndDisplayBooks();
        });
    }

    if (searchButton && searchInput) {
        searchButton.addEventListener('click', () => {
            currentSearchTerm = searchInput.value;
            filterAndDisplayBooks();
        });
    }

    function getBookSummary(title: string, author: string): string {
        return `A captivating story about ${title} by ${author}. Discover its secrets and delve into a world of imagination. More details coming soon! This is a placeholder summary to give an idea of the content length.`;
    }

    function updateBookmarkButtonUI(bookId: string) {
        if (!bookmarkButton || !bookmarkIcon || !bookmarkText) return;
        const isBookmarked = bookmarkedBooks.has(bookId);
        bookmarkButton.setAttribute('aria-pressed', String(isBookmarked));
        if (isBookmarked) {
            bookmarkIcon.textContent = '📌';
            bookmarkText.textContent = 'Bookmarked';
        } else {
            bookmarkIcon.textContent = '🔖';
            bookmarkText.textContent = 'Bookmark';
        }
    }

    function displayBookDetail(bookData: BookData | undefined | null) {
        if (!bookData) {
            console.error("Book data is missing for detail view.");
            return;
        }
        currentBookData = bookData;
        if (!bookDetailCover || !bookDetailTitle || !bookDetailAuthor || !bookDetailCategories || !bookDetailSummary) return;

        bookDetailTitle.textContent = bookData.title;
        bookDetailAuthor.textContent = bookData.author;
        bookDetailCategories.textContent = bookData.categories.join(', ');
        
        bookDetailCover.className = 'book-detail-cover'; 
        if (bookData.coverClass) {
            bookDetailCover.classList.add(bookData.coverClass);
        } else {
            bookDetailCover.style.setProperty('--book-color-1', '#E0E0E0');
            bookDetailCover.style.setProperty('--book-color-2', '#C0C0C0');
        }

        bookDetailSummary.textContent = getBookSummary(bookData.title, bookData.author);
        bookDetailSummary.classList.remove('loading');
        
        updateBookmarkButtonUI(bookData.id);
        showView('bookDetail');
    }

    domBookCards.forEach(card => {
        const bookId = (card as HTMLElement).dataset.bookId;
        if (bookId) {
            const bookData = allBooks.find(b => b.id === bookId);
            card.addEventListener('click', () => {
                displayBookDetail(bookData);
            });
            card.addEventListener('keydown', (event) => {
                if ((event as KeyboardEvent).key === 'Enter' || (event as KeyboardEvent).key === ' ') {
                     displayBookDetail(bookData);
                }
            });
        }
    });

    if (backButton) {
        backButton.addEventListener('click', () => {
            if (viewHistory.length > 0) {
                const previousViewId = viewHistory.pop()!; // Non-null assertion as length > 0
                showView(previousViewId, true); // Pass true for isBackNavigation
            } else {
                // Fallback if history is empty (e.g., deep linked to detail view)
                showView('mainApp', true); // Pass true for isBackNavigation
            }
            currentBookData = null; // Ensure data is cleared when explicitly going back
        });
    }

    if (bookmarkButton) {
        bookmarkButton.addEventListener('click', () => {
            if (!currentBookData) return;
            const bookId = currentBookData.id;
            if (bookmarkedBooks.has(bookId)) {
                bookmarkedBooks.delete(bookId);
            } else {
                bookmarkedBooks.add(bookId);
            }
            updateBookmarkButtonUI(bookId);
            if (activeViewId === 'bookmarks') { 
                renderBookmarks();
            }
             if (activeViewId === 'friendFeed') { 
                renderFriendFeed(); 
            }
        });
    }

    function renderScrollFeed() {
        if (!views.scrollFeed) return;
        views.scrollFeed.innerHTML = ''; 

        allBooks.forEach(book => {
            const item = document.createElement('div');
            item.className = 'scroll-book-item';
            item.setAttribute('role', 'group');
            item.setAttribute('aria-label', `Book: ${book.title}`);

            const cover = document.createElement('div');
            cover.className = 'scroll-book-cover';
            if (book.coverClass) {
                cover.classList.add(book.coverClass);
            } else {
                cover.style.setProperty('--book-color-1', '#D0D0D0');
                cover.style.setProperty('--book-color-2', '#B0B0B0');
            }

            const titleEl = document.createElement('h2');
            titleEl.className = 'scroll-book-title';
            titleEl.textContent = book.title;

            const authorEl = document.createElement('p');
            authorEl.className = 'scroll-book-author';
            authorEl.textContent = book.author;

            const summaryEl = document.createElement('p');
            summaryEl.className = 'scroll-book-summary';
            summaryEl.textContent = getBookSummary(book.title, book.author);
            
            item.appendChild(cover);
            item.appendChild(titleEl);
            item.appendChild(authorEl);
            item.appendChild(summaryEl);
            
            item.addEventListener('click', () => displayBookDetail(book));

            views.scrollFeed?.appendChild(item);
        });
    }

    function renderBookmarks() {
        if (!views.bookmarks || !bookmarkedBookList || !noBookmarksMessage) return;
        bookmarkedBookList.innerHTML = ''; 

        const booksToShow = allBooks.filter(book => bookmarkedBooks.has(book.id));

        if (booksToShow.length === 0) {
            noBookmarksMessage.style.display = 'block';
            bookmarkedBookList.style.display = 'none';
        } else {
            noBookmarksMessage.style.display = 'none';
            bookmarkedBookList.style.display = 'grid'; 

            booksToShow.forEach(book => {
                const listItem = document.createElement('li');
                listItem.className = 'book-card'; 
                listItem.setAttribute('data-category', book.categories.join(','));
                if (book.coverClass) {
                    listItem.setAttribute('data-cover-class', book.coverClass);
                }
                listItem.dataset.bookId = book.id; 
                listItem.setAttribute('role', 'button');
                listItem.tabIndex = 0;

                const coverWrapper = document.createElement('div');
                coverWrapper.className = 'book-cover-wrapper';
                const coverDiv = document.createElement('div');
                coverDiv.className = 'book-cover';
                if (book.coverClass) {
                    coverDiv.classList.add(book.coverClass);
                } else {
                    coverDiv.style.setProperty('--book-color-1', '#E0E0E0');
                    coverDiv.style.setProperty('--book-color-2', '#C0C0C0');
                }
                coverWrapper.appendChild(coverDiv);

                const bookInfoDiv = document.createElement('div');
                bookInfoDiv.className = 'book-info';
                const titleH3 = document.createElement('h3');
                titleH3.className = 'book-title';
                titleH3.textContent = book.title;
                const authorP = document.createElement('p');
                authorP.className = 'book-author';
                authorP.textContent = book.author;
                bookInfoDiv.appendChild(titleH3);
                bookInfoDiv.appendChild(authorP);

                listItem.appendChild(coverWrapper);
                listItem.appendChild(bookInfoDiv);

                listItem.addEventListener('click', () => displayBookDetail(book));
                listItem.addEventListener('keydown', (event) => {
                    if ((event as KeyboardEvent).key === 'Enter' || (event as KeyboardEvent).key === ' ') {
                        displayBookDetail(book);
                    }
                });
                bookmarkedBookList.appendChild(listItem);
            });
        }
    }

    function renderFriendFeed() {
        if (!friendActivityList || !noFriendActivityMessage) return;
        friendActivityList.innerHTML = '';

        if (placeholderFriendActivities.length === 0) {
            noFriendActivityMessage.style.display = 'block';
            friendActivityList.style.display = 'none';
        } else {
            noFriendActivityMessage.style.display = 'none';
            friendActivityList.style.display = 'block';

            placeholderFriendActivities.forEach(activity => {
                const item = document.createElement('li');
                item.className = 'friend-activity-item';
                item.setAttribute('role', 'article');
                item.setAttribute('aria-label', `${activity.friendName} ${activity.action} ${activity.bookTitle}`);

                const avatar = document.createElement('div');
                avatar.className = 'friend-activity-avatar';
                avatar.textContent = activity.friendInitial;
                avatar.setAttribute('aria-hidden', 'true');

                const mainContent = document.createElement('div');
                mainContent.className = 'friend-activity-main';

                const text = document.createElement('p');
                text.className = 'friend-activity-text';
                const friendNameStrong = document.createElement('strong');
                friendNameStrong.textContent = activity.friendName;
                const bookTitleEm = document.createElement('em');
                bookTitleEm.textContent = activity.bookTitle;
                
                text.appendChild(friendNameStrong);
                text.append(` ${activity.action} `);
                text.appendChild(bookTitleEm);
                text.append('.');
                mainContent.appendChild(text);

                if (activity.reviewText) {
                    const reviewBlock = document.createElement('blockquote');
                    reviewBlock.className = 'friend-activity-review';
                    reviewBlock.textContent = `"${activity.reviewText}"`;
                    mainContent.appendChild(reviewBlock);
                }

                if (typeof activity.rating === 'number' && activity.rating >= 0 && activity.rating <= 5) {
                    const ratingStars = document.createElement('div');
                    ratingStars.className = 'friend-activity-rating';
                    ratingStars.setAttribute('aria-label', `${activity.rating} out of 5 stars`);
                    ratingStars.textContent = '★'.repeat(activity.rating) + '☆'.repeat(5 - activity.rating);
                    mainContent.appendChild(ratingStars);
                }
                
                const timestamp = document.createElement('span');
                timestamp.className = 'friend-activity-timestamp';
                timestamp.textContent = activity.timestamp;
                mainContent.appendChild(timestamp);
                
                item.appendChild(avatar);
                item.appendChild(mainContent);
                
                const bookData = allBooks.find(b => b.title === activity.bookTitle);
                if (bookData) {
                    item.addEventListener('click', () => displayBookDetail(bookData));
                    item.style.cursor = 'pointer'; 
                    item.tabIndex = 0; 
                     item.addEventListener('keydown', (event) => {
                        if ((event as KeyboardEvent).key === 'Enter' || (event as KeyboardEvent).key === ' ') {
                            displayBookDetail(bookData);
                        }
                    });
                }
                friendActivityList.appendChild(item);
            });
        }
    }

    // Navigation event listeners
    navHomeButton?.addEventListener('click', () => showView('mainApp'));
    navDiscoverButton?.addEventListener('click', () => showView('scrollFeed'));
    navFriendFeedButton?.addEventListener('click', () => showView('friendFeed'));
    navBookmarksButton?.addEventListener('click', () => showView('bookmarks'));

    initBooksData(); 
    // Re-assign event listeners for dynamically added book cards (e.g. in bookmarks) is handled by renderBookmarks
    // This initial assignment is for the static cards in index.html
    domBookCards.forEach(card => {
        const bookId = (card as HTMLElement).dataset.bookId;
        if (bookId) {
            const bookData = allBooks.find(b => b.id === bookId);
            card.addEventListener('click', () => {
                displayBookDetail(bookData);
            });
            card.addEventListener('keydown', (event) => {
                if ((event as KeyboardEvent).key === 'Enter' || (event as KeyboardEvent).key === ' ') {
                     displayBookDetail(bookData);
                }
            });
        }
    });
    showView('mainApp'); 
});