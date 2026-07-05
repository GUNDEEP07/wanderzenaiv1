'use strict';

const validatePostInput = (title, description, content, location, country, travelDates, category) => {
  if (!title || typeof title !== 'string' || title.trim().length < 3 || title.length > 200) {
    throw new Error('Post title is required, must be 3-200 characters');
  }

  if (!description || typeof description !== 'string' || description.trim().length < 10 || description.length > 500) {
    throw new Error('Post description is required, must be 10-500 characters');
  }

  if (!content || typeof content !== 'string' || content.trim().length < 50 || content.length > 50000) {
    throw new Error('Post content is required, must be 50-50000 characters');
  }

  if (!location || typeof location !== 'string' || location.trim().length < 2 || location.length > 100) {
    throw new Error('Location is required, must be 2-100 characters');
  }

  if (!country || typeof country !== 'string' || country.trim().length < 2 || country.length > 100) {
    throw new Error('Country is required, must be 2-100 characters');
  }

  if (travelDates) {
    if (typeof travelDates !== 'object' || !travelDates.start || !travelDates.end) {
      throw new Error('Travel dates must be an object with "start" and "end" properties in YYYY-MM-DD format');
    }

    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(travelDates.start) || !dateRegex.test(travelDates.end)) {
      throw new Error('Travel dates must be in YYYY-MM-DD format');
    }

    const start = new Date(travelDates.start);
    const end = new Date(travelDates.end);
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || start >= end) {
      throw new Error('Travel dates must be valid and start date must be before end date');
    }
  }

  const validCategories = ['tips', 'adventure', 'culture', 'food', 'budget', 'other'];
  if (!category || !validCategories.includes(category)) {
    throw new Error(`Category must be one of: ${validCategories.join(', ')}`);
  }
};

const validatePhotoUpload = (s3Key, fileSize) => {
  if (!s3Key || typeof s3Key !== 'string') {
    throw new Error('S3 key is required');
  }

  if (typeof fileSize !== 'number' || fileSize <= 0) {
    throw new Error('File size must be a positive number');
  }

  const maxFileSize = 10 * 1024 * 1024;
  if (fileSize > maxFileSize) {
    throw new Error(`File size exceeds maximum of 10MB (received ${(fileSize / 1024 / 1024).toFixed(2)}MB)`);
  }

  const validExtensions = ['jpg', 'png', 'webp', 'gif'];
  const extension = s3Key.toLowerCase().split('.').pop();

  if (!validExtensions.includes(extension)) {
    throw new Error(`Photo format must be one of: ${validExtensions.join(', ')}`);
  }
};

module.exports = {
  validatePostInput,
  validatePhotoUpload,
};
