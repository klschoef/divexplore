const images = document.querySelectorAll('.image');
const zooms = document.querySelectorAll('.zoom');

// Loop through each image and add a click event listener
images.forEach((image, index) => {
    image.addEventListener('click', () => {
        // Hide all other zoomed images
        zooms.forEach((zoom) => {
            if (zoom !== zooms[index]) {
                zoom.style.display = 'none';
            }
        });

        // Show the zoomed image for the clicked image
        zooms[index].style.display = 'block';
        zooms[index].parentNode.style.overflow = 'visible';
    });

    // Add a click event listener to the zoomed image to hide it
    zooms[index].addEventListener('click', () => {
        zooms[index].style.display = 'none';
        zooms[index].parentNode.style.overflow = 'hidden';
    });
});