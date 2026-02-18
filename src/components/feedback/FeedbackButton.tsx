import React, { useState } from "react";
import { MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { FeedbackForm } from "./FeedbackForm";

export function FeedbackButton() {
    const [open, setOpen] = useState(false);

    return (
        <div className="fixed bottom-6 right-6 z-50">
            <Dialog open={open} onOpenChange={setOpen}>
                <DialogTrigger asChild>
                    <Button
                        className="h-14 px-6 rounded-full shadow-lg hover:scale-105 transition-transform bg-primary text-primary-foreground flex items-center gap-3 font-semibold text-lg"
                    >
                        <MessageSquare className="h-7 w-7" />
                        <span>Feedback Form</span>
                    </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Give us your feedback</DialogTitle>
                        <DialogDescription>
                            We'd love to hear your thoughts on how we can improve our service.
                        </DialogDescription>
                    </DialogHeader>
                    <FeedbackForm onSuccess={() => setOpen(false)} />
                </DialogContent>
            </Dialog>
        </div>
    );
}
