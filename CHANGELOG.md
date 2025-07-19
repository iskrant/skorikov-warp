# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **New Gesture Controls**:
  - **Swipe Up to Close**: Users can now swipe up on mobile devices to close the lightbox gallery
  - **Pinch to Zoom**: Restored pinch-to-zoom functionality for detailed image examination on touch devices
  - **Enhanced Touch Navigation**: Improved touch gesture handling for better mobile experience

### Fixed
- **Overlay Click Passthrough**: Fixed issue where clicks on the overlay background would sometimes not close the lightbox
- **Touch Event Handling**: Improved touch event processing to prevent conflicts between different gestures
- **Mobile Responsiveness**: Enhanced touch interaction reliability across different mobile browsers

### Technical
- Added comprehensive touch gesture detection system
- Implemented proper event handling for zoom and swipe gestures
- Added gesture validation to prevent accidental triggers
- Improved overlay click detection and handling
