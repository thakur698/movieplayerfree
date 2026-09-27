import { createMediaCard } from './MediaCard.js';
import { Icons } from '../icons.js';

export function createMediaRow({ title, icon, items = [], onSeeAll = null, seeAllType = null }) {
  if (!items || items.length === 0) return document.createDocumentFragment();

  const section = document.createElement('section');
  section.className = 'media-row-section';

  const rowId = `row-${Math.random().toString(36).substring(2, 9)}`;

  section.innerHTML = `
    <div class="row-header">
      <div class="row-header-title">
        ${icon ? `<span class="row-icon">${icon}</span>` : ''}
        <h2>${title}</h2>
      </div>
      <div class="row-header-controls">
        ${onSeeAll ? `<button class="row-see-all-btn" data-type="${seeAllType || ''}">See All ${Icons.chevronRight}</button>` : ''}
        <button class="row-nav-arrow row-arrow-left" data-target="${rowId}" title="Scroll left" aria-label="Scroll left">
          ${Icons.chevronLeft}
        </button>
        <button class="row-nav-arrow row-arrow-right" data-target="${rowId}" title="Scroll right" aria-label="Scroll right">
          ${Icons.chevronRight}
        </button>
      </div>
    </div>

    <div class="media-row-scroll" id="${rowId}">
      <div class="media-row-track"></div>
    </div>
  `;

  const track = section.querySelector('.media-row-track');
  items.forEach(item => {
    // Only display items with poster
    if (item.poster_path) {
      const card = createMediaCard(item);
      track.appendChild(card);
    }
  });

  // Attach horizontal scroll navigation
  const scrollContainer = section.querySelector(`#${rowId}`);
  const leftBtn = section.querySelector('.row-arrow-left');
  const rightBtn = section.querySelector('.row-arrow-right');

  const getScrollAmount = () => {
    return Math.floor(scrollContainer.clientWidth * 0.75);
  };

  if (leftBtn) {
    leftBtn.addEventListener('click', () => {
      scrollContainer.scrollBy({ left: -getScrollAmount(), behavior: 'smooth' });
    });
  }

  if (rightBtn) {
    rightBtn.addEventListener('click', () => {
      scrollContainer.scrollBy({ left: getScrollAmount(), behavior: 'smooth' });
    });
  }

  // See All click
  if (onSeeAll) {
    const seeAllBtn = section.querySelector('.row-see-all-btn');
    if (seeAllBtn) {
      seeAllBtn.addEventListener('click', () => onSeeAll(seeAllType));
    }
  }

  return section;
}
