package com.dashdash.auth;

import java.util.Optional;
import org.springframework.data.mongodb.repository.MongoRepository;

public interface UserRepository extends MongoRepository<User, String> {
    Optional<User> findByEmail(String email);
    Optional<User> findByGoogleSub(String googleSub);
    Optional<User> findBySubscriptionStripeCustomerId(String stripeCustomerId);
    Optional<User> findBySubscriptionStripeSubscriptionId(String stripeSubscriptionId);
}
