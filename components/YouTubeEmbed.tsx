import React from 'react';

interface YouTubeEmbedProps {
    videoId: string;
    title?: string;
}

const YouTubeEmbed: React.FC<YouTubeEmbedProps> = ({ videoId, title = 'Recipe Video' }) => {
    return (
        <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-gray-900 shadow-lg">
            <iframe
                src={`https://www.youtube.com/embed/${videoId}?rel=0&modestbranding=1`}
                title={title}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="absolute inset-0 w-full h-full"
            />
        </div>
    );
};

export default YouTubeEmbed;
